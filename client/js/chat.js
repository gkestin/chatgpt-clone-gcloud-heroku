const query = (obj) =>
  Object.keys(obj)
    .map((k) => encodeURIComponent(k) + "=" + encodeURIComponent(obj[k]))
    .join("&");
const colorThemes = document.querySelectorAll('[name="theme"]');
const markdown = window.markdownit();
const message_box = document.getElementById(`messages`);
const message_input = document.getElementById(`message-input`);
const box_conversations = document.querySelector(`.top`);
const spinner = box_conversations.querySelector(".spinner");
const stop_generating = document.querySelector(`.stop_generating`);
const send_button = document.querySelector(`#send-button`);
let prompt_lock = false;

// Fetch user email from the HTML input field.(NOT GLOBAL BELOW LINE)
//const userEmail = document.getElementById('email').value;

// Fetch user email from the global variable.
//const userEmail = window.userEmail;

// FETCH USER EMAIL FROM LOCAL STORAGE (since aboe 2 didn't work)
const userEmail = window.localStorage.getItem('userEmail');


// Use Firestore instance from your Firebase (but GREG removed b/c declared in index.html)
//const db = firebase.firestore();

hljs.addPlugin(new CopyButtonPlugin());

function resizeTextarea(textarea) {
  textarea.style.height = '80px';
  textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
}

const format = (text) => {
  return text.replace(/(?:\r\n|\r|\n)/g, "<br>");
};

message_input.addEventListener("blur", () => {
  window.scrollTo(0, 0);
});

message_input.addEventListener("focus", () => {
  document.documentElement.scrollTop = document.documentElement.scrollHeight;
});

//am I setting user email correctly?
console.log(userEmail);

const delete_conversations = async () => {
  // Use Firestore's batch write to delete all conversation documents
  const batch = db.batch();
  const userConversationsRef = db.collection(userEmail);
  const snapshot = await userConversationsRef.get();
  snapshot.docs.forEach((doc) => {
    batch.delete(doc.ref);
  });
  await batch.commit();

  // Start a new conversation
};

const handle_ask = async () => {
  message_input.style.height = `80px`;
  message_input.focus();

  window.scrollTo(0, 0);
  let message = message_input.value;

  if (message.length > 0) {
    message_input.value = ``;
    await ask_gpt(message);
  }
};

const remove_cancel_button = async () => {
  stop_generating.classList.add(`stop_generating-hiding`);

  setTimeout(() => {
    stop_generating.classList.remove(`stop_generating-hiding`);
    stop_generating.classList.add(`stop_generating-hidden`);
  }, 300);
};



const ask_gpt = async (message) => {
  try {
    message_input.value = ``;
    message_input.innerHTML = ``;
    message_input.innerText = ``;

    add_conversation(window.conversation_id, message.substr(0, 20));
    window.scrollTo(0, 0);
    window.controller = new AbortController();

    jailbreak = document.getElementById("jailbreak");
    model = document.getElementById("model");
    prompt_lock = true;
    window.text = ``;
    window.token = message_id();

    stop_generating.classList.remove(`stop_generating-hidden`);

    message_box.innerHTML += `
            <div class="message">
                <div class="user">
                    ${user_image}
                    <i class="fa-regular fa-phone-arrow-up-right"></i>
                </div>
                <div class="content" id="user_${token}">
                    ${format(message)}
                </div>
            </div>
        `;

    /* .replace(/(?:\r\n|\r|\n)/g, '<br>') */

    message_box.scrollTop = message_box.scrollHeight;
    window.scrollTo(0, 0);
    await new Promise((r) => setTimeout(r, 500));
    window.scrollTo(0, 0);

    message_box.innerHTML += `
            <div class="message">
                <div class="user">
                    ${gpt_image} <i class="fa-regular fa-phone-arrow-down-left"></i>
                </div>
                <div class="content" id="gpt_${window.token}">
                    <div id="cursor"></div>
                </div>
            </div>
        `;

    message_box.scrollTop = message_box.scrollHeight;
    window.scrollTo(0, 0);
    await new Promise((r) => setTimeout(r, 1000));
    window.scrollTo(0, 0);

    const response = await fetch(`/backend-api/v2/conversation`, {
      method: `POST`,
      signal: window.controller.signal,
      headers: {
        "content-type": `application/json`,
        accept: `text/event-stream`,
      },
      body: JSON.stringify({
        conversation_id: window.conversation_id,
        action: `_ask`,
        model: model.options[model.selectedIndex].value,
        jailbreak: jailbreak.options[jailbreak.selectedIndex].value,
        meta: {
          id: window.token,
          content: {
            conversation: await get_conversation(window.conversation_id),
            internet_access: document.getElementById("switch").checked,
            content_type: "text",
            parts: [
              {
                content: message,
                role: "user",
              },
            ],
          },
        },
      }),
    });

    // chatGPT suggests: add this line to create a reader from the response body
    const reader = response.body.getReader();

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      chunk = new TextDecoder().decode(value);

      if (
        chunk.includes(
          `<form id="challenge-form" action="/backend-api/v2/conversation?`
        )
      ) {
        chunk = `cloudflare token expired, please refresh the page.`;
      }

      text += chunk;

      document.getElementById(`gpt_${window.token}`).innerHTML =
        markdown.render(text);
      document.querySelectorAll(`code`).forEach((el) => {
        hljs.highlightElement(el);
      });

      window.scrollTo(0, 0);
      message_box.scrollTo({ top: message_box.scrollHeight, behavior: "auto" });
    }

    if (
      text.includes(
        `instead. Maintaining this website and API costs a lot of money`
      )
    ) {
      document.getElementById(`gpt_${window.token}`).innerHTML =
        "An error occured, please reload / refresh cache and try again.";
    }

    // Here's where the messages are stored
    console.log(`Adding user message: ${message}`);//DEBUG
    await add_message(window.conversation_id, "user", message);

    console.log(`Adding assistant message: ${text}`);//DEBUG
    await add_message(window.conversation_id, "assistant", text);

    message_box.scrollTop = message_box.scrollHeight;
    await remove_cancel_button();
    prompt_lock = false;

    // Loading the conversations
    await load_conversations(20, 0);
    window.scrollTo(0, 0);
  } catch (e) {
    console.log(`Adding user message in catch block: ${message}`);//DEBUG
    await add_message(window.conversation_id, "user", message);

    message_box.scrollTop = message_box.scrollHeight;
    await remove_cancel_button();
    prompt_lock = false;

    // Loading the conversations
    await load_conversations(20, 0);

    console.log(e);

    let cursorDiv = document.getElementById(`cursor`);
    if (cursorDiv) cursorDiv.parentNode.removeChild(cursorDiv);

    if (e.name != `AbortError`) {
      let error_message = `oops ! something went wrong, please try again / reload. [stacktrace in console]`;

      document.getElementById(`gpt_${window.token}`).innerHTML = error_message;
      await add_message(window.conversation_id, "assistant", error_message);
    } else {
      document.getElementById(`gpt_${window.token}`).innerHTML += ` [aborted]`;
      await add_message(window.conversation_id, "assistant", text + ` [aborted]`);
    }

    window.scrollTo(0, 0);
  }
};



const clear_conversations = async () => {
  const elements = box_conversations.childNodes;
  let index = elements.length;

  if (index > 0) {
    while (index--) {
      const element = elements[index];
      if (
        element.nodeType === Node.ELEMENT_NODE &&
        element.tagName.toLowerCase() !== `button`
      ) {
        box_conversations.removeChild(element);
      }
    }
  }
};

const clear_conversation = async () => {
  let messages = message_box.getElementsByTagName(`div`);

  while (messages.length > 0) {
    message_box.removeChild(messages[0]);
  }
};

const show_option = async (conversation_id) => {
  const conv = document.getElementById(`conv-${conversation_id}`);
  const yes = document.getElementById(`yes-${conversation_id}`);
  const not = document.getElementById(`not-${conversation_id}`);

  conv.style.display = "none";
  yes.style.display = "block";
  not.style.display = "block";
};

const hide_option = async (conversation_id) => {
  const conv = document.getElementById(`conv-${conversation_id}`);
  const yes = document.getElementById(`yes-${conversation_id}`);
  const not = document.getElementById(`not-${conversation_id}`);

  conv.style.display = "block";
  yes.style.display = "none";
  not.style.display = "none";
};

// Deletes a conversation from Firestore
const delete_conversation = async (conversation_id) => {
  await db.collection(userEmail).doc(conversation_id).delete();
  // Code for manipulating the UI

  const conversation = document.getElementById(`convo-${conversation_id}`);
  conversation.remove();

  if (window.conversation_id == conversation_id) {
    await new_conversation();
  }

  await load_conversations(20, 0, true);
};

// Sets the active conversation
const set_conversation = async (conversation_id) => {
  // Code for updating URL and UI
  history.pushState({}, null, `/chat/${conversation_id}`);
  window.conversation_id = conversation_id;

  // Code for loading the conversation and its messages
  await clear_conversation();
  await load_conversation(conversation_id);
  await load_conversations(20, 0, true);
};

// Creates a new conversation
const new_conversation = async () => {
  // Code for updating URL and generating new conversation ID
  history.pushState({}, null, `/chat/`);
  window.conversation_id = uuid();

  // Code for loading conversations
  await clear_conversation();
  await load_conversations(20, 0, true);
};

// Loads a conversation from Firestore
const load_conversation = async (conversation_id) => {
  const conversation = await db.collection(userEmail).doc(conversation_id).get();
  const conversationData = conversation.data();
  // Code for rendering messages and handling UI behavior

  for (item of conversationData.items) {
    message_box.innerHTML += `
            <div class="message">
                <div class="user">
                    ${item.role == "assistant" ? gpt_image : user_image}
                    ${
                      item.role == "assistant"
                        ? `<i class="fa-regular fa-phone-arrow-down-left"></i>`
                        : `<i class="fa-regular fa-phone-arrow-up-right"></i>`
                    }
                </div>
                <div class="content">
                    ${
                      item.role == "assistant"
                        ? markdown.render(item.content)
                        : item.content
                    }
                </div>
            </div>
        `;
  }

  document.querySelectorAll(`code`).forEach((el) => {
    hljs.highlightElement(el);
  });

  message_box.scrollTo({ top: message_box.scrollHeight, behavior: "smooth" });

  setTimeout(() => {
    message_box.scrollTop = message_box.scrollHeight;
  }, 500);
};

// Fetches a conversation's messages
const get_conversation = async (conversation_id) => {
  const conversation = await db.collection(userEmail).doc(conversation_id).get();
  return conversation.data().items;
};

// Adds a new conversation to Firestore
const add_conversation = async (conversation_id, title) => {
  const conversationRef = db.collection(userEmail).doc(conversation_id);
  const conversation = await conversationRef.get();

  if (!conversation.exists) {
    await conversationRef.set({
      id: conversation_id,
      title: title,
      items: [],
    });
  }
};




const add_message = async (conversation_id, role, content) => {
  return new Promise(async (resolve, reject) => {
    try {
      const conversationRef = db.collection(userEmail).doc(conversation_id);
      const conversation = await conversationRef.get();
      const conversationData = conversation.data();
      conversationData.items.push({
        role: role,
        content: content,
      });
      await conversationRef.update(conversationData); // update conversation
      console.log(`Message added: ${role}: ${content}`); //DEBUG
      resolve(); // Successfully finished
    } catch(error) {
      reject(error); // Something went wrong
    }
  });
};


const load_conversations = async (limit, offset, loader) => {
  const conversations = [];
  const snapshot = await db.collection(userEmail).get();
  snapshot.docs.forEach((doc) => {
    conversations.push(doc.data());
  });

  //if (loader === undefined) spinner.parentNode.removeChild(spinner)
  await clear_conversations();

  for (conversation of conversations) {
    box_conversations.innerHTML += `
    <div class="convo" id="convo-${conversation.id}">
      <div class="left" onclick="set_conversation('${conversation.id}')">
          <i class="fa-regular fa-comments"></i>
          <span class="convo-title">${conversation.title}</span>
      </div>
      <i onclick="show_option('${conversation.id}')" class="fa-regular fa-trash" id="conv-${conversation.id}"></i>
      <i onclick="delete_conversation('${conversation.id}')" class="fa-regular fa-check" id="yes-${conversation.id}" style="display:none;"></i>
      <i onclick="hide_option('${conversation.id}')" class="fa-regular fa-x" id="not-${conversation.id}" style="display:none;"></i>
    </div>
    `;
  }

  document.querySelectorAll(`code`).forEach((el) => {
    hljs.highlightElement(el);
  });
};

document.getElementById(`cancelButton`).addEventListener(`click`, async () => {
  window.controller.abort();
  console.log(`aborted ${window.conversation_id}`);
});

function h2a(str1) {
  var hex = str1.toString();
  var str = "";

  for (var n = 0; n < hex.length; n += 2) {
    str += String.fromCharCode(parseInt(hex.substr(n, 2), 16));
  }

  return str;
}

const uuid = () => {
  return `xxxxxxxx-xxxx-4xxx-yxxx-${Date.now().toString(16)}`.replace(
    /[xy]/g,
    function (c) {
      var r = (Math.random() * 16) | 0,
        v = c == "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    }
  );
};

const message_id = () => {
  random_bytes = (Math.floor(Math.random() * 1338377565) + 2956589730).toString(
    2
  );
  unix = Math.floor(Date.now() / 1000).toString(2);

  return BigInt(`0b${unix}${random_bytes}`).toString();
};



window.onload = async () => {
  load_settings_firestore();

  conversations = 0;
  const snapshot = await db.collection(userEmail).get();
  conversations = snapshot.size;

  if (conversations == 0) {
    await db.collection(userEmail).doc().delete();
  }

  await setTimeout(() => {
    load_conversations(20, 0);
  }, 1);

  if (!window.location.href.endsWith(`#`)) {
    if (/\/chat\/.+/.test(window.location.href)) {
      await load_conversation(window.conversation_id);
    }
  }

  message_input.addEventListener(`keydown`, async (evt) => {
    if (prompt_lock) return;
    if (evt.keyCode === 13 && !evt.shiftKey) {
      evt.preventDefault();
      console.log('pressed enter');
      await handle_ask();
    } else {
      message_input.style.removeProperty("height");
      message_input.style.height = message_input.scrollHeight + 4 + "px";
    }
  });

  send_button.addEventListener(`click`, async () => {
    console.log("clicked send");
    if (prompt_lock) return;
    await handle_ask();
  });

  register_settings_firestore();
};

document.querySelector(".mobile-sidebar").addEventListener("click", (event) => {
  const sidebar = document.querySelector(".conversations");

  if (sidebar.classList.contains("shown")) {
    sidebar.classList.remove("shown");
    event.target.classList.remove("rotated");
  } else {
    sidebar.classList.add("shown");
    event.target.classList.add("rotated");
  }

  window.scrollTo(0, 0);
});

const register_settings_firestore = async () => {
  settings_ids = ["switch", "model", "jailbreak"];
  settings_elements = settings_ids.map((id) => document.getElementById(id));
  settings_elements.map((element) =>
    element.addEventListener(`change`, async (event) => {
      const setting = {};
      switch (event.target.type) {
        case "checkbox":
          setting[event.target.id] = event.target.checked;
          break;
        case "select-one":
          setting[event.target.id] = event.target.selectedIndex;
          break;
        default:
          console.warn("Unresolved element type");
      }
      await db.collection(userEmail).doc("settings").set(setting, { merge: true });
    })
  );
};

const load_settings_firestore = async () => {
  settings_ids = ["switch", "model", "jailbreak"];
  settings_elements = settings_ids.map((id) => document.getElementById(id));
  const doc = await db.collection(userEmail).doc("settings").get();
  const settings = doc.data();
  settings_elements.map((element) => {
    if (settings && settings[element.id] !== undefined) {
      switch (element.type) {
        case "checkbox":
          element.checked = settings[element.id];
          break;
        case "select-one":
          element.selectedIndex = settings[element.id];
          break;
        default:
          console.warn("Unresolved element type");
      }
    }
  });
};

// Theme storage for recurring viewers
const storeTheme = async function (theme) {
  await db.collection(userEmail).doc("theme").set({ theme: theme });
};

// set theme when visitor returns
const setTheme = async function () {
  const doc = await db.collection(userEmail).doc("theme").get();
  const data = doc.data();
  const activeTheme = data ? data.theme : '';
  colorThemes.forEach((themeOption) => {
    if (themeOption.id === activeTheme) {
      themeOption.checked = true;
    }
  });
  // fallback for no :has() support
  document.documentElement.className = activeTheme;
};

colorThemes.forEach((themeOption) => {
  themeOption.addEventListener("click", () => {
    storeTheme(themeOption.id);
    // fallback for no :has() support
    document.documentElement.className = themeOption.id;
  });
});

document.onload = setTheme();



