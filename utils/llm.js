// 从全局配置中获取API密钥
const SIFLOW_API_KEY = getApp().globalData.siflowApiKey || '';
const SILICONFLOW_API_URL = 'https://api.siliconflow.cn/v1/chat/completions';

const MODELS = {
  DEEPSEEK: 'deepseek-ai/DeepSeek-R1-Distill-Qwen-7B',
};

const systemPrompt = `# 角色：你是一位围棋AI助手，请根据当前盘面状态分析并返回最佳落子位置

## 重要说明
- 你必须返回一个有效的JSON对象，不要包含任何其他文本或markdown标记
- 不要使用代码块标记（\`\`\`）
- 确保所有数值都是数字类型，不要使用字符串
- 确保JSON格式完全正确，包括引号、逗号等

## 输入格式
{
  "game_state": {
    "board": [[0,1,-1,...], ...], # 19x19矩阵，0表示空，1表示黑子，-1表示白子
    "history": ["Q16", "D4"],     # 落子顺序
    "komi": 7.5,                 # 贴目
    "rules": "chinese"           # 规则体系
  },
  "ai_config": {
    "level": "pro",              # 难度等级
    "time_limit": 30             # 思考时间(秒)
  }
}

## 响应格式
{
  "recommend_move": "K10",        # 推荐落子位置
  "win_probability": 0.67,       # 胜率评估（必须是数字）
  "variations": [                # 备选方案
    {"move": "K10", "score": 0.72},
    {"move": "R5", "score": 0.65}
  ],
  "analysis": "在K10落子可以控制中腹，同时威胁对手的弱棋"  # 分析说明
}

## 示例响应
{
  "recommend_move": "K10",
  "win_probability": 0.67,
  "variations": [
    {"move": "K10", "score": 0.72},
    {"move": "R5", "score": 0.65}
  ],
  "analysis": "在K10落子可以控制中腹，同时威胁对手的弱棋"
}`;

// 测试函数：验证API连接
async function testLLMConnection() {
  console.log('Testing LLM connection...');
  console.log('API Key:', SIFLOW_API_KEY ? 'Present' : 'Missing');
  console.log('API URL:', SILICONFLOW_API_URL);

  if (!SIFLOW_API_KEY) {
    console.error('API key is missing');
    return false;
  }

  try {
    const testPrompt = "Hello, this is a test message.";
    const response = await generateAIResponse(testPrompt);
    console.log('Test response:', response);
    return true;
  } catch (error) {
    console.error('Test failed:', error);
    return false;
  }
}

async function generateAIResponse(prompt, model = MODELS.DEEPSEEK, options = {}) {
  const { temperature = 0.7, max_tokens = 512 } = options;

  if (!SIFLOW_API_KEY) {
    console.error('API key not configured');
    throw new Error('API key not configured. Please set siflowApiKey in app.js globalData');
  }

  let apiUrl, requestBody, headers;

  apiUrl = SILICONFLOW_API_URL;
  headers = {
    accept: 'application/json',
    'content-type': 'application/json',
    authorization: 'Bearer ' + SIFLOW_API_KEY
  };
  requestBody = {
    model: model,
    messages: [{"role":"system","content":systemPrompt},{ role: 'user', content: prompt }],
    stream: false,
    max_tokens,
    temperature,
    top_p: 0.7,
    top_k: 50,
    frequency_penalty: 0.5,
    n: 1
  };

  console.log('Sending request to LLM:', {
    url: apiUrl,
    headers: { ...headers, authorization: 'Bearer ***' }, // Hide API key in logs
    body: requestBody
  });

  try {
    const response = await new Promise((resolve, reject) => {
      wx.request({
        url: apiUrl,
        method: 'POST',
        header: headers,
        data: requestBody,
        success: (res) => {
          console.log('LLM API response:', res);
          resolve(res);
        },
        fail: (err) => {
          console.error('LLM API request failed:', err);
          reject(err);
        }
      });
    });

    if (response.statusCode !== 200) {
      console.error("API error response:", response);
      throw new Error(`API error: ${response.statusCode} ${response.errMsg}`);
    }

    if (!response.data || !response.data.choices || !response.data.choices[0] || !response.data.choices[0].message) {
      console.error("Invalid API response format:", response.data);
      throw new Error('Invalid API response format');
    }

    return response.data.choices[0].message.content;
  } catch (error) {
    console.error('Error generating response:', error);
    throw error;
  }
}

// 处理游戏状态并获取AI响应
async function getAIResponse(gameState, aiConfig) {
  const requestData = {
    game_state: gameState,
    ai_config: aiConfig
  };
  
  try {
    console.log('Sending game state to LLM:', requestData);
    const response = await generateAIResponse(JSON.stringify(requestData));
    console.log('Raw LLM response:', response);
    
    try {
      // 尝试清理响应文本，移除可能的markdown代码块标记
      let cleanedResponse = response;
      if (response.includes('```json')) {
        cleanedResponse = response.split('```json')[1].split('```')[0].trim();
      } else if (response.includes('```')) {
        cleanedResponse = response.split('```')[1].split('```')[0].trim();
      }
      
      console.log('Cleaned response:', cleanedResponse);
      
      const parsedResponse = JSON.parse(cleanedResponse);
      console.log('Parsed LLM response:', parsedResponse);
      
      // Validate response format
      if (!parsedResponse.recommend_move) {
        console.error('Missing recommend_move in response:', parsedResponse);
        throw new Error('Invalid response format: missing recommend_move');
      }
      if (typeof parsedResponse.win_probability !== 'number') {
        console.error('Invalid win_probability in response:', parsedResponse);
        throw new Error('Invalid response format: win_probability must be a number');
      }
      if (!Array.isArray(parsedResponse.variations)) {
        console.error('Invalid variations in response:', parsedResponse);
        throw new Error('Invalid response format: variations must be an array');
      }
      
      return parsedResponse;
    } catch (parseError) {
      console.error('Error parsing LLM response:', parseError);
      console.error('Original response:', response);
      throw new Error('Failed to parse LLM response as JSON: ' + parseError.message);
    }
  } catch (error) {
    console.error('Error getting AI response:', error);
    throw error;
  }
}

export { generateAIResponse, getAIResponse, MODELS, testLLMConnection };