import OpenAI from 'openai'
import dotenv from 'dotenv'
dotenv.config()

const client = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: 'https://api.deepseek.com'
})

async function test() {
  const response = await client.chat.completions.create({
    model: 'deepseek-chat',
    messages: [
      { role: 'user', content: '你好，请回复"连接成功"' }
    ]
  })

  console.log(response.choices[0].message.content)
}

test()
