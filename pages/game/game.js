const { getAIResponse, testLLMConnection } = require('../../utils/llm');

// 难度配置
const DIFFICULTY_CONFIG = {
  'beginner': { size: 9, handicap: 0 },
  'intermediate': { size: 13, handicap: 0 },
  'advanced': { size: 19, handicap: 0 },
  'professional': { size: 19, handicap: 0 }
};

Page({
  data: {
    boardSize: 19, // 默认棋盘大小
    board: [], // 棋盘状态，0表示空，1表示黑子，-1表示白子
    currentPlayer: 'black', // 当前玩家颜色
    gameStatus: 'playing', // 游戏状态：playing, ended
    aiLevel: 'beginner', // AI难度级别
    playerInfo: {
      name: '玩家',
      timeUsed: 0,
      captures: 0
    },
    aiInfo: {
      name: 'AI',
      timeUsed: 0,
      captures: 0
    },
    difficultyLevels: [
      { id: 'beginner', name: '初级' },
      { id: 'intermediate', name: '中级' },
      { id: 'advanced', name: '高级' },
      { id: 'professional', name: '职业' }
    ],
    moveHistory: [], // 落子历史，记录坐标
    aiAnalysis: '', // AI分析说明
    aiVariations: [], // AI备选方案
    winProbability: 0, // AI评估的胜率
    isLoading: false, // 添加加载状态
    errorMessage: '', // 添加错误信息
    thinkingTime: 0, // AI思考时间
    thinkingTimer: null, // 计时器引用
    handicapStones: [], // 让子位置
    coordinateLetters: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T']
  }, 


  onLoad: function() {
    console.log('boardSize:', this.data.boardSize); // Check if this logs the correct value
  },

  onLoad: async function() {
    this.initBoard();
    
    // 测试LLM连接
    try {
      console.log('Testing LLM connection on page load...');
      const isConnected = await testLLMConnection();
      if (!isConnected) {
        this.showError('AI服务连接失败，请检查网络和API配置');
      } else {
        console.log('LLM connection test successful');
      }
    } catch (error) {
      console.error('LLM connection test failed:', error);
      this.showError('AI服务连接测试失败: ' + error.message);
    }
  },

  // 初始化棋盘
  initBoard: function() {
    const config = DIFFICULTY_CONFIG[this.data.aiLevel];
    const board = Array(config.size).fill().map(() => 
      Array(config.size).fill(0)
    );
    
    // 放置让子
    const handicapStones = this.getHandicapStones(config.size, config.handicap);
    handicapStones.forEach(({row, col}) => {
      board[row][col] = 1; // 黑子（玩家）
    });

    // Update coordinate letters based on board size
    const coordinateLetters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T'].slice(0, config.size);
    console.log('New coordinate letters:', coordinateLetters, 'for size:', config.size);

    this.setData({ 
      boardSize: config.size,
      board,
      moveHistory: [],
      aiAnalysis: '',
      aiVariations: [],
      winProbability: 0,
      errorMessage: '',
      handicapStones,
      coordinateLetters
    });
  },

  // 获取让子位置
  getHandicapStones: function(size, handicap) {
    const stones = [];
    if (handicap === 0) return stones;

    // 标准让子位置
    const positions = [
      {row: 2, col: 2},
      {row: 2, col: size - 3},
      {row: size - 3, col: 2},
      {row: size - 3, col: size - 3},
      {row: Math.floor(size/2), col: Math.floor(size/2)}
    ];

    // 根据让子数量选择位置
    for (let i = 0; i < handicap; i++) {
      if (i < positions.length) {
        stones.push(positions[i]);
      }
    }

    return stones;
  },

  // 坐标转换：棋盘坐标 -> 数组索引
  coordToIndex: function(coord) {
    const col = coord.charCodeAt(0) - 'A'.charCodeAt(0);
    const row = this.data.boardSize - parseInt(coord.slice(1));
    return { row, col };
  },

  // 坐标转换：数组索引 -> 棋盘坐标
  indexToCoord: function(row, col) {
    const colChar = String.fromCharCode('A'.charCodeAt(0) + col);
    return `${colChar}${this.data.boardSize - row}`;
  },

  // 显示错误信息
  showError: function(message) {
    this.setData({
      errorMessage: message,
      isLoading: false
    });
    wx.showToast({
      title: message,
      icon: 'none',
      duration: 3000
    });
  },

  // 开始计时
  startThinkingTimer: function() {
    this.setData({ thinkingTime: 0 });
    this.data.thinkingTimer = setInterval(() => {
      this.setData({
        thinkingTime: this.data.thinkingTime + 1
      });
    }, 1000);
  },

  // 停止计时
  stopThinkingTimer: function() {
    if (this.data.thinkingTimer) {
      clearInterval(this.data.thinkingTimer);
      this.data.thinkingTimer = null;
    }
  },

  // 落子
  placeStone: async function(e) {
    if (this.data.gameStatus !== 'playing') return;
    if (this.data.isLoading) return; // 防止重复请求
    
    const { row, col } = e.currentTarget.dataset;
    if (this.data.board[row][col] !== 0) return;

    this.setData({ isLoading: true, errorMessage: '' });
    this.startThinkingTimer(); // 开始计时

    try {
      // 创建新的棋盘状态
      const newBoard = this.data.board.map(row => [...row]);
      newBoard[row][col] = this.data.currentPlayer === 'black' ? 1 : -1;
      
      // 记录移动
      const moveCoord = this.indexToCoord(row, col);
      const moveHistory = [...this.data.moveHistory, moveCoord];
      
      this.setData({
        board: newBoard,
        moveHistory,
        currentPlayer: this.data.currentPlayer === 'black' ? 'white' : 'black'
      });

      // 获取AI响应
      const gameState = {
        board: this.data.board,
        history: this.data.moveHistory,
        komi: 7.5,
        rules: "chinese"
      };

      const aiConfig = {
        level: this.data.aiLevel,
        time_limit: 30,
        handicap: DIFFICULTY_CONFIG[this.data.aiLevel].handicap
      };

      console.log('Requesting AI response for game state:', gameState);
      const aiResponse = await getAIResponse(gameState, aiConfig);
      console.log('Received AI response:', aiResponse);
      
      // 更新AI分析信息
      this.setData({
        aiAnalysis: aiResponse.analysis,
        aiVariations: aiResponse.variations,
        winProbability: aiResponse.win_probability
      });

      // AI落子
      if (aiResponse.recommend_move) {
        const { row: aiRow, col: aiCol } = this.coordToIndex(aiResponse.recommend_move);
        if (this.data.board[aiRow][aiCol] === 0) {
          const aiBoard = this.data.board.map(row => [...row]);
          aiBoard[aiRow][aiCol] = this.data.currentPlayer === 'black' ? 1 : -1;
          
          this.setData({
            board: aiBoard,
            moveHistory: [...this.data.moveHistory, aiResponse.recommend_move],
            currentPlayer: this.data.currentPlayer === 'black' ? 'white' : 'black'
          });
        }
      }
    } catch (error) {
      console.error('Error in placeStone:', error);
      this.showError(error.message || 'AI响应出错，请重试');
    } finally {
      this.stopThinkingTimer(); // 停止计时
      this.setData({ isLoading: false });
    }
  },

  // 悔棋
  undoMove: function() {
    if (this.data.moveHistory.length === 0) return;
    if (this.data.isLoading) return;
    
    const moveHistory = [...this.data.moveHistory];
    moveHistory.pop(); // 移除最后一步
    
    // 重新初始化棋盘
    const board = Array(this.data.boardSize).fill().map(() => 
      Array(this.data.boardSize).fill(0)
    );
    
    // 重新放置所有棋子
    moveHistory.forEach(move => {
      const { row, col } = this.coordToIndex(move);
      board[row][col] = moveHistory.indexOf(move) % 2 === 0 ? 1 : -1;
    });
    
    this.setData({
      board,
      moveHistory,
      currentPlayer: this.data.currentPlayer === 'black' ? 'white' : 'black',
      aiAnalysis: '',
      aiVariations: [],
      winProbability: 0,
      errorMessage: ''
    });
  },

  // 认输
  resign: function() {
    if (this.data.isLoading) return;
    
    this.setData({
      gameStatus: 'ended'
    });
    wx.showModal({
      title: '游戏结束',
      content: '你已认输',
      showCancel: false
    });
  },

  // 选择AI难度
  selectDifficulty: function(e) {
    if (this.data.isLoading) return;
    
    const level = e.currentTarget.dataset.level;
    console.log('Changing difficulty to:', level); // Add debug log
    
    this.setData({
      aiLevel: level
    }, () => {
      console.log('After setData - boardSize:', this.data.boardSize); // Add debug log
      this.restartGame();
    });
  },

  // 重新开始游戏
  restartGame: function() {
    if (this.data.isLoading) return;
    
    this.initBoard();
    this.setData({
      gameStatus: 'playing',
      currentPlayer: 'black',
      playerInfo: {
        name: '玩家',
        timeUsed: 0,
        captures: 0
      },
      aiInfo: {
        name: 'AI',
        timeUsed: 0,
        captures: 0
      }
    });
  },

  // 页面卸载时清理计时器
  onUnload: function() {
    this.stopThinkingTimer();
  }
}); 

