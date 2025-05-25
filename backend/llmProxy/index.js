// 云函数入口文件
const cloud = require('wx-server-sdk')
const axios = require('axios')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

// 云函数入口函数
exports.main = async (event, context) => {
  console.log('Cloud function started with event:', event)
  const { prompt, model, options } = event
  const wxContext = cloud.getWXContext()
  console.log('WX Context:', wxContext)

  try {
    // 从云开发环境变量中获取API密钥
    const apiKey = process.env.SIFLOW_API_KEY
    console.log('API Key present:', !!apiKey)

    if (!apiKey) {
      console.error('API key not found in environment variables')
      throw new Error('API key not configured in cloud environment')
    }

    // 构建请求体
    const requestBody = {
      model: model || 'deepseek-ai/DeepSeek-R1-Distill-Qwen-7B',
      messages: prompt,
      ...options
    }

    // 设置axios超时时间
    const axiosInstance = axios.create({
      timeout: 10000, // 2秒超时
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    })

    // 发送请求到API
    const response = await axiosInstance.post('https://api.siliconflow.cn/v1/chat/completions', requestBody)

    // 返回API响应
    return {
      success: true,
      data: response.data,
      openid: wxContext.OPENID,
      appid: wxContext.APPID,
      unionid: wxContext.UNIONID,
    }
  } catch (error) {
    console.error('API request failed:', error)
    // 处理超时错误
    if (error.code === 'ECONNABORTED') {
      return {
        success: false,
        error: 'Request timeout. Please try again.',
        openid: wxContext.OPENID,
        appid: wxContext.APPID,
        unionid: wxContext.UNIONID,
      }
    }
    return {
      success: false,
      error: error.message || 'Unknown error occurred',
      openid: wxContext.OPENID,
      appid: wxContext.APPID,
      unionid: wxContext.UNIONID,
    }
  }
} 