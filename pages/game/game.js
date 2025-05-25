const { getAIResponse, testLLMConnection } = require('../../utils/llm');

Page({
  data: {
    boardSize: 19, // 19x19 标准围棋棋盘
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
    errorMessage: '' // 添加错误信息
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
    const board = Array(this.data.boardSize).fill().map(() => 
      Array(this.data.boardSize).fill(0)
    );
    this.setData({ 
      board,
      moveHistory: [],
      aiAnalysis: '',
      aiVariations: [],
      winProbability: 0,
      errorMessage: ''
    });
  },

  // 坐标转换：棋盘坐标 -> 数组索引
  coordToIndex: function(coord) {
    const col = coord.charCodeAt(0) - 'A'.charCodeAt(0);
    const row = parseInt(coord.slice(1)) - 1;
    return { row, col };
  },

  // 坐标转换：数组索引 -> 棋盘坐标
  indexToCoord: function(row, col) {
    const colChar = String.fromCharCode('A'.charCodeAt(0) + col);
    return `${colChar}${row + 1}`;
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

  // 落子
  placeStone: async function(e) {
    if (this.data.gameStatus !== 'playing') return;
    if (this.data.isLoading) return; // 防止重复请求
    
    const { row, col } = e.currentTarget.dataset;
    if (this.data.board[row][col] !== 0) return;

    this.setData({ isLoading: true, errorMessage: '' });

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
        time_limit: 30
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
    this.setData({
      aiLevel: level
    });
    this.restartGame();
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
  }
}); 