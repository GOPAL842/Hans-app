// Simple Pong implementation using Canvas
// Player controls left paddle with mouse or Up/Down arrow keys.
// Right paddle is controlled by simple AI.

(() => {
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');

  // Score elements
  const playerScoreEl = document.getElementById('playerScore');
  const computerScoreEl = document.getElementById('computerScore');

  // Buttons
  const startBtn = document.getElementById('startBtn');
  const resetBtn = document.getElementById('resetBtn');

  // Game constants
  const WIDTH = canvas.width;
  const HEIGHT = canvas.height;

  const PADDLE_WIDTH = 12;
  const PADDLE_HEIGHT = 100;
  const PADDLE_SPEED = 6; // for keyboard control

  const BALL_RADIUS = 8;
  const BALL_SPEED = 5; // base speed

  // Game state
  let playerScore = 0;
  let computerScore = 0;
  let running = false;
  let lastTime = performance.now();

  // Left paddle (player)
  const leftPaddle = {
    x: 10,
    y: (HEIGHT - PADDLE_HEIGHT) / 2,
    width: PADDLE_WIDTH,
    height: PADDLE_HEIGHT,
    dy: 0
  };

  // Right paddle (computer)
  const rightPaddle = {
    x: WIDTH - PADDLE_WIDTH - 10,
    y: (HEIGHT - PADDLE_HEIGHT) / 2,
    width: PADDLE_WIDTH,
    height: PADDLE_HEIGHT,
  };

  // Ball
  const ball = {
    x: WIDTH / 2,
    y: HEIGHT / 2,
    r: BALL_RADIUS,
    vx: 0,
    vy: 0
  };

  // Input
  const keys = {
    ArrowUp: false,
    ArrowDown: false
  };

  // Init
  function resetBall(direction = null) {
    ball.x = WIDTH / 2;
    ball.y = HEIGHT / 2;

    // Random angle between -30 and 30 degrees, convert to radians
    const angle = (Math.random() * Math.PI / 3) - (Math.PI / 6);
    // Start direction: if direction is 'left' or 'right' prefer that
    const dir = direction === 'left' ? -1 : direction === 'right' ? 1 : (Math.random() < 0.5 ? -1 : 1);

    ball.vx = dir * (BALL_SPEED + Math.random() * 1.5);
    ball.vy = Math.sin(angle) * (BALL_SPEED + Math.random() * 1.5);
  }

  function startGame() {
    if (!running) {
      running = true;
      lastTime = performance.now();
      requestAnimationFrame(loop);
    }
  }

  function stopGame() {
    running = false;
  }

  // Score update and pause after scoring
  function scorePoint(winner) {
    if (winner === 'player') {
      playerScore++;
      playerScoreEl.textContent = playerScore;
      resetBall('right');
    } else {
      computerScore++;
      computerScoreEl.textContent = computerScore;
      resetBall('left');
    }
    // brief pause before resuming
    stopGame();
    setTimeout(startGame, 700);
  }

  // Collision helpers
  function rectCircleColliding(rect, circle) {
    // Find closest point to circle within rectangle
    const closestX = Math.max(rect.x, Math.min(circle.x, rect.x + rect.width));
    const closestY = Math.max(rect.y, Math.min(circle.y, rect.y + rect.height));
    const dx = circle.x - closestX;
    const dy = circle.y - closestY;
    return (dx * dx + dy * dy) < (circle.r * circle.r);
  }

  // Rendering
  function draw() {
    // Clear
    ctx.clearRect(0, 0, WIDTH, HEIGHT);

    // Midline
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    const dashH = 12;
    const gap = 10;
    for (let y = 0; y < HEIGHT; y += dashH + gap) {
      ctx.fillRect(WIDTH / 2 - 1, y, 2, dashH);
    }

    // Paddles
    ctx.fillStyle = '#08f';
    roundRect(ctx, leftPaddle.x, leftPaddle.y, leftPaddle.width, leftPaddle.height, 6, true, false);
    roundRect(ctx, rightPaddle.x, rightPaddle.y, rightPaddle.width, rightPaddle.height, 6, true, false);

    // Ball
    ctx.beginPath();
    ctx.fillStyle = '#fff';
    ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Simple rounded rectangle helper
  function roundRect(ctx, x, y, w, h, r) {
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
    ctx.fill();
  }

  // Main loop
  function loop(now) {
    if (!running) return;

    const dt = (now - lastTime) / (1000 / 60); // nominal 60fps units
    lastTime = now;

    // Update paddles
    // Keyboard control
    if (keys.ArrowUp) leftPaddle.y -= PADDLE_SPEED * dt;
    if (keys.ArrowDown) leftPaddle.y += PADDLE_SPEED * dt;
    // Clamp
    leftPaddle.y = clamp(leftPaddle.y, 0, HEIGHT - leftPaddle.height);

    // Simple computer AI for right paddle: follow the ball with some easing and max speed
    const aiCenter = rightPaddle.y + rightPaddle.height / 2;
    const diff = ball.y - aiCenter;
    const aiSpeed = 4.0; // adjust for difficulty
    rightPaddle.y += clamp(diff, -aiSpeed * dt, aiSpeed * dt);
    rightPaddle.y = clamp(rightPaddle.y, 0, HEIGHT - rightPaddle.height);

    // Move ball
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;

    // Wall collisions (top/bottom)
    if (ball.y - ball.r <= 0) {
      ball.y = ball.r;
      ball.vy = -ball.vy;
    } else if (ball.y + ball.r >= HEIGHT) {
      ball.y = HEIGHT - ball.r;
      ball.vy = -ball.vy;
    }

    // Paddle collisions
    const leftRect = { x: leftPaddle.x, y: leftPaddle.y, width: leftPaddle.width, height: leftPaddle.height };
    const rightRect = { x: rightPaddle.x, y: rightPaddle.y, width: rightPaddle.width, height: rightPaddle.height };
    if (rectCircleColliding(leftRect, ball) && ball.vx < 0) {
      // reflect and add spin based on where it hit the paddle
      reflectFromPaddle(leftPaddle);
    } else if (rectCircleColliding(rightRect, ball) && ball.vx > 0) {
      reflectFromPaddle(rightPaddle);
    }

    // Score detection (ball left or right out of bounds)
    if (ball.x + ball.r < 0) {
      // Computer scores
      scorePoint('computer');
    } else if (ball.x - ball.r > WIDTH) {
      // Player scores
      scorePoint('player');
    }

    draw();
    requestAnimationFrame(loop);
  }

  function reflectFromPaddle(paddle) {
    // Determine hit position relative to paddle center (-1 to 1)
    const relativeIntersectY = (ball.y - (paddle.y + paddle.height / 2));
    const normalized = relativeIntersectY / (paddle.height / 2);
    // Max bounce angle: 70 degrees
    const maxBounce = (70 * Math.PI) / 180;
    const angle = normalized * maxBounce;

    // Determine direction
    const dir = paddle === leftPaddle ? 1 : -1;
    const speed = Math.hypot(ball.vx, ball.vy) * 1.03; // slight speed up on hit
    ball.vx = dir * Math.cos(angle) * Math.max(speed, BALL_SPEED);
    ball.vy = Math.sin(angle) * Math.max(speed, BALL_SPEED);

    // Nudge ball out of the paddle so it doesn't get stuck
    if (dir === 1) {
      ball.x = paddle.x + paddle.width + ball.r + 0.1;
    } else {
      ball.x = paddle.x - ball.r - 0.1;
    }
  }

  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }

  // Input handlers
  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const scaleY = canvas.height / rect.height;
    const y = (e.clientY - rect.top) * scaleY;
    // Center paddle around mouse y
    leftPaddle.y = clamp(y - leftPaddle.height / 2, 0, HEIGHT - leftPaddle.height);
  });

  // Show pointer when over controls, hide when over canvas is set in CSS via cursor: none.
  canvas.addEventListener('mouseenter', () => {
    // optional: hide cursor already handled in CSS
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      keys[e.key] = true;
      e.preventDefault();
    } else if (e.key === ' ' || e.key === 'Spacebar') {
      // Space toggles start/pause
      if (running) stopGame(); else startGame();
    }
  });

  window.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      keys[e.key] = false;
      e.preventDefault();
    }
  });

  startBtn.addEventListener('click', () => {
    startGame();
  });

  resetBtn.addEventListener('click', () => {
    playerScore = 0;
    computerScore = 0;
    playerScoreEl.textContent = playerScore;
    computerScoreEl.textContent = computerScore;
    resetBall();
    stopGame();
    setTimeout(startGame, 200);
  });

  // Initialize ball and draw initial frame
  resetBall();
  draw();

  // Auto-start after a short delay so player can get ready
  setTimeout(() => {
    startGame();
  }, 400);

})();