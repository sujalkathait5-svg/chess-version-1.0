// backend/ws/matchmaking.js
const { v4: uuidv4 } = require('uuid');

// Queues by category (bullet, blitz, rapid)
const queues = {
  bullet: [],
  blitz: [],
  rapid: [],
};

// Start the matcher interval
let ioInstance = null;
let matcherInterval = null;

function initMatchmaker(io) {
  ioInstance = io;
  if (!matcherInterval) {
    matcherInterval = setInterval(processQueues, 1000);
  }
}

function getCategory(timeControl) {
  if (timeControl.category) return timeControl.category;
  const minutes = timeControl.minutes;
  if (minutes < 3) return 'bullet';
  if (minutes < 10) return 'blitz';
  return 'rapid';
}

function handleMatchmaking(io, socket, user, data, onMatchFound) {
  const { timeControl } = data;
  if (!timeControl) return;

  if (!ioInstance) initMatchmaker(io);

  const category = getCategory(timeControl);
  if (!queues[category]) queues[category] = [];

  // Remove if already in queue
  removeSocketFromQueue(socket.id);

  // Default rating to 1500 if missing
  let rating = 1500;
  if (user && user.ratings) {
    rating = user.ratings.vsHuman || 1500;
  }

  queues[category].push({
    socket,
    user,
    timeControl,
    rating,
    joinTime: Date.now(),
    onMatchFound
  });
}

function processQueues() {
  const now = Date.now();

  for (const category of Object.keys(queues)) {
    const queue = queues[category];
    if (queue.length < 2) continue;

    // Evaluate pairs
    for (let i = 0; i < queue.length; i++) {
      for (let j = i + 1; j < queue.length; j++) {
        const p1 = queue[i];
        const p2 = queue[j];

        // Ensure same time control exactly (e.g. 3+2 vs 3+2)
        if (p1.timeControl.minutes !== p2.timeControl.minutes || p1.timeControl.increment !== p2.timeControl.increment) {
          continue;
        }

        const wait1 = (now - p1.joinTime) / 1000;
        const wait2 = (now - p2.joinTime) / 1000;

        const maxWait = Math.max(wait1, wait2);

        let allowedDiff = 100;
        if (maxWait >= 30) allowedDiff = 500;
        else if (maxWait >= 20) allowedDiff = 300;
        else if (maxWait >= 10) allowedDiff = 200;

        const diff = Math.abs(p1.rating - p2.rating);

        // TODO: check recent games for rematch restriction

        if (diff <= allowedDiff || maxWait >= 30) { // If wait is long, bypass some rules if needed
          // Match!
          const roomId = uuidv4();
          
          p1.onMatchFound({ roomId, timeControl: p1.timeControl, player1: p1, player2: p2 });
          
          // Remove from queue
          queue.splice(j, 1);
          queue.splice(i, 1);
          
          // Reset loop variables as array mutated
          i--;
          break;
        }
      }
    }
  }
}

function handleCancelMatchmaking(socket) {
  removeSocketFromQueue(socket.id);
}

function removeSocketFromQueue(socketId) {
  Object.keys(queues).forEach(category => {
    queues[category] = queues[category].filter(p => p.socket.id !== socketId);
  });
}

module.exports = {
  initMatchmaker,
  handleMatchmaking,
  handleCancelMatchmaking,
  removeSocketFromQueue
};
