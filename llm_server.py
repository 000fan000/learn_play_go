from zhipuai import ZhipuAI
import os
from dotenv import load_dotenv
load_dotenv()

zhipu_token = os.getenv('ZHIPU_TOKEN')
client = ZhipuAI(api_key=zhipu_token) # qiao
free_model = 'glm-4-flash'
big_model = 'glm-4-plus' # 0.05/ktoken 128k
balance_long_model = 'glm-4-air-0111' # 0.0005/ktoken 128k
zero_model = 'glm-zero-preview' # 0.01/ktoken 16k

def get_response(input, model=free_model, max_tokens=1024,top_p=0.7,temperature=temp):
    response = client.chat.completions.create(
        model=model,
        messages=[
        {
            "role": "system",
            "content": "Please think deeply before your response, and answer as concise and accurate as possible." 
        },
        {
            "role": "user",
            "content": input
        }
    ],
        top_p= top_p,
        temperature= temperature,
        max_tokens=max_tokens,
        stream=False
    )

    # return response['choices'][0]['message']['content']
    return response.choices[0].message.content
# TypeError: 'Completion' object is not subscriptable

# get user input from stdin
print("Please input your question:")
input = input()
if input == 'exit':
    print("Bye!")
    exit()
else:
    res = get_response(input,model=free_model,temperature=0.3)
    print(res)
# model="glm-zero-preview"
# input = "Who are you'
# res = get_response(input,model=free_model,temperature=0.3)
# print(res)