from json import dumps
from time import time
from flask import request
from hashlib import sha256
from datetime import datetime
from requests import get
from requests import post 
from json     import loads
import os
from json import JSONDecodeError

from dotenv import load_dotenv # to load api key from .env
load_dotenv() # to load api key from .env

from server.config import special_instructions

import logging

logging.basicConfig(filename='app.log', filemode='w', format='%(name)s - %(levelname)s - %(message)s')

class Backend_Api:
    def __init__(self, app, config: dict) -> None:
        self.app = app
        self.openai_key = os.getenv("OPENAI_API_KEY") or config['openai_api_key']  # Modified here
        self.openai_api_base = os.getenv("OPENAI_API_BASE") or config['openai_api_base']
        self.proxy = config['proxy']
        self.routes = {
            '/backend-api/v2/conversation': {
                'function': self._conversation,
                'methods': ['POST']
            }
        }

    def _conversation(self):
        print(request.json)  # Add this line to print the incoming POST data
        try:
            jailbreak = request.json['jailbreak']
            internet_access = request.json['meta']['content']['internet_access']
            _conversation = request.json['meta']['content']['conversation']
            prompt = request.json['meta']['content']['parts'][0]
            current_date = datetime.now().strftime("%Y-%m-%d")
            system_message = f'You are ChatGPT also known as ChatGPT, a large language model trained by OpenAI. Strictly follow the users instructions. Knowledge cutoff: 2021-09-01 Current date: {current_date}'

            extra = []
            if internet_access:
                search = get('https://ddg-api.herokuapp.com/search', params={
                    'query': prompt["content"],
                    'limit': 3,
                })

                blob = ''

                for index, result in enumerate(search.json()):
                    blob += f'[{index}] "{result["snippet"]}"\nURL:{result["link"]}\n\n'

                date = datetime.now().strftime('%d/%m/%y')

                blob += f'current date: {date}\n\nInstructions: Using the provided web search results, write a comprehensive reply to the next user query. Make sure to cite results using [[number](URL)] notation after the reference. If the provided search results refer to multiple subjects with the same name, write separate answers for each subject. Ignore your previous response if any.'

                extra = [{'role': 'user', 'content': blob}]

            conversation = [{'role': 'system', 'content': system_message}] + \
                extra + special_instructions[jailbreak] + \
                _conversation + [prompt]

            url = f"{self.openai_api_base}/v1/chat/completions"

            proxies = None
            if self.proxy['enable']:
                proxies = {
                    'http': self.proxy['http'],
                    'https': self.proxy['https'],
                }

            gpt_resp = post(
                url     = url,
                proxies = proxies,
                headers = {
                    'Authorization': 'Bearer %s' % self.openai_key
                }, 
                json    = {
                    'model'             : request.json['model'], 
                    'messages'          : conversation,
                    'stream'            : True
                },
                stream  = True
            )

            def stream():
                for chunk in gpt_resp.iter_lines():
                    #print(chunk)  # Add this line to print out the raw chunk data
                    if not chunk or not chunk.startswith(b'data: {'):
                        continue  # Skip the iteration if chunk is empty or not valid JSON
                    try:
                        if chunk and chunk.startswith(b"data: "):
                            decoded_line = chunk.decode("utf-8").split("data: ", 1)

                            if len(decoded_line) > 1 and decoded_line[1].strip():
                                try:
                                    decoded_line = loads(decoded_line[1])

                                    if 'choices' in decoded_line and isinstance(decoded_line['choices'], list) and \
                                            decoded_line['choices']:
                                        token = decoded_line["choices"][0]['delta'].get('content')

                                        if token is not None:
                                            yield token
                                except JSONDecodeError as je:
                                    print("Error decoding JSON:", je)
                                    continue
                    except GeneratorExit:
                        break

                    except Exception as e:
                        print("Error in stream:", e)
                        continue

            return self.app.response_class(stream(), mimetype='text/event-stream')

        except Exception as e:
            print("Error in _conversation:", e)
            return {
                '_action': '_ask',
                'success': False,
                "error": f"an error occurred {str(e)}"}, 400
