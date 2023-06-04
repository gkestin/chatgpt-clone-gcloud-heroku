//firebase.auth().onAuthStateChanged(function(user) {
//  if (user) {
//    document.getElementById('message').innerHTML = 'Logged in as ' + user.email;
//    document.addEventListener('DOMContentLoaded', function() { enableChat(); });
//  } else {
//    window.location.href = "/assets/html/login.html";
//  }
//});
//ABOVE IS only for when trying login.html

document.addEventListener('DOMContentLoaded', function() {

  // Get references to the form elements.
  const emailField = document.getElementById('email');
  const passwordField = document.getElementById('password');
  const loginButton = document.getElementById('login');
  const logoutButton = document.getElementById('logout');
  const messageField = document.getElementById('message');
  const messageInput = document.getElementById('message-input'); // added this line

  // Keep a reference to the current chat script so we can remove it when user logs out.
  let chatScript = null;

  // Function to enable the chat when the user is logged in.
  // function enableChat() {
  //  messageInput.disabled = false;
  //  messageInput.placeholder = "Ask a question";

    // Load the chat.js script
//    chatScript = document.createElement('script');
//    chatScript.src = '/assets/js/chat.js';
//    chatScript.defer = true;
//    document.head.appendChild(chatScript);
//  }

  // Function to disable the chat when the user is logged out.
//  function disableChat() {
//    messageInput.disabled = true;
//    messageInput.placeholder = "Please log in / sign up";

    // Remove the chat.js script
//    if (chatScript) {
//      document.head.removeChild(chatScript);
//      chatScript = null;
//    }
//  }

  loginButton.onclick = function() {
    // Sign in Firebase using email and password.
    const email = emailField.value;
    const password = passwordField.value;

    firebase.auth().signInWithEmailAndPassword(email, password)
      .then((userCredential) => {
        console.log('Logged in successfully');
        logoutButton.style.display = 'block';
        loginButton.style.display = 'none';
        messageField.innerHTML = 'Logged in successfully';
        window.userEmail = email; // Setting the global variable for user email.
        window.localStorage.setItem('userEmail', email); //Use local storage to bring email to index.html
        window.location.href = "/assets/html/index.html"; //When trying to do login.html
      })
      .catch((error) => {
        console.log('Login failed, attempting to sign up');
        // No user, try to sign up
        firebase.auth().createUserWithEmailAndPassword(email, password)
          .then((userCredential) => {
            console.log('Signed up successfully');
            logoutButton.style.display = 'block';
            loginButton.style.display = 'none';
            messageField.innerHTML = 'Signed up and logged in successfully';
            window.userEmail = email; // Setting the global variable for user email.
            window.localStorage.setItem('userEmail', email); //Use local storage to bring email to index.html
            window.location.href = "/assets/html/index.html"; //When trying to do login.html
          })
          .catch((error) => {
            console.log(`Failed to sign up or log in: ${error.message}`);
            messageField.innerHTML = error.message;
          });
      });
  };

  logoutButton.onclick = function() {
    console.log('Attempting to log out');
    // Sign out Firebase.
    firebase.auth().signOut()
      .then(() => {
        console.log('Logged out successfully');
        logoutButton.style.display = 'none';
        loginButton.style.display = 'block';
        messageField.innerHTML = 'Logged out successfully';
        window.userEmail = null; // Clearing the global variable for user email on logout.
        window.localStorage.removeItem('userEmail'); //clearing it in local storage
        window.location.href = "/assets/html/login.html"; // redirect to login.html on successful logout
      })
      .catch((error) => {
        console.log(`Failed to log out: ${error.message}`);
        messageField.innerHTML = error.message;
      });
  };
});
