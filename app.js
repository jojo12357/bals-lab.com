// app.js - Complete application logic
class NoiseVisualizer {
    constructor() {
        // Configuration object for noise thresholds
        this.config = {
            noiseThresholds: {
                quiet: 40,        // 0-40 dB: Тыныш
                normal: 60,       // 40-60 dB: Қалыпты
                warning: 70,      // 60-70 dB: Назар аудар!
                caution: 80,      // 70-80 dB: Тшш... Тынышырақ!
                loud: 100         // 80+ dB: ӨТЕ ҚАТТЫ!
            },
            animation: {
                ballCount: 30,
                sensitivity: 1.0,
                smoothing: 0.3
            },
            audio: {
                calibrationOffset: 0,
                minDb: 20,
                maxDb: 100
            }
        };

        // Application state
        this.state = {
            isListening: false,
            audioContext: null,
            analyserNode: null,
            microphoneStream: null,
            currentDb: 0,
            smoothedDb: 0,
            noiseHistory: [],
            maxHistoryLength: 60, // 60 data points for 60 seconds
            balls: [],
            animationId: null,
            lastTime: 0,
            messageTimeout: null,
            highNoiseStartTime: null,
            canvas: null,
            ctx: null
        };

        // DOM elements cache
        this.elements = {};

        this.init();
    }

    // Initialize the application
    init() {
        this.cacheElements();
        this.setupEventListeners();
        this.initializeCanvas();
        this.initializeBalls();
        this.updateStatsDisplay();
        this.loadSettings();
        this.setupResizeHandler();
    }

    // Cache DOM elements for better performance
    cacheElements() {
        this.elements = {
            startBtn: document.getElementById('start-btn'),
            settingsBtn: document.getElementById('settings-btn'),
            fullscreenBtn: document.getElementById('fullscreen-btn'),
            resetBtn: document.getElementById('reset-btn'),
            noiseValue: document.getElementById('noise-value'),
            noiseStatus: document.getElementById('noise-status'),
            noiseFill: document.getElementById('noise-fill'),
            historyGraph: document.getElementById('history-graph'),
            minValue: document.getElementById('min-value'),
            avgValue: document.getElementById('avg-value'),
            maxValue: document.getElementById('max-value'),
            settingsModal: document.getElementById('settings-modal'),
            closeSettings: document.getElementById('close-settings'),
            closeSettingsBottom: document.getElementById('close-settings-bottom'),
            saveSettings: document.getElementById('save-settings'),
            resetSettings: document.getElementById('reset-settings'),
            ballCount: document.getElementById('ball-count'),
            ballCountValue: document.getElementById('ball-count-value'),
            sensitivity: document.getElementById('sensitivity'),
            sensitivityValue: document.getElementById('sensitivity-value'),
            smoothing: document.getElementById('smoothing'),
            smoothingValue: document.getElementById('smoothing-value'),
            calibration: document.getElementById('calibration'),
            showGraph: document.getElementById('show-graph'),
            fullscreenMode: document.getElementById('fullscreen-mode'),
            messageContainer: document.getElementById('message-container'),
            canvas: document.getElementById('visualizer-canvas')
        };
    }

    // Set up event listeners
    setupEventListeners() {
        // Start/Stop microphone button
        this.elements.startBtn.addEventListener('click', () => this.toggleMicrophone());
        
        // Settings button
        this.elements.settingsBtn.addEventListener('click', () => this.openSettings());
        
        // Close settings modal
        this.elements.closeSettings.addEventListener('click', () => this.closeSettings());
        this.elements.closeSettingsBottom.addEventListener('click', () => this.closeSettings());
        
        // Save settings
        this.elements.saveSettings.addEventListener('click', () => this.saveSettings());
        
        // Reset settings
        this.elements.resetSettings.addEventListener('click', () => this.resetSettings());
        
        // Reset statistics
        this.elements.resetBtn.addEventListener('click', () => this.resetStatistics());
        
        // Fullscreen button
        this.elements.fullscreenBtn.addEventListener('click', () => this.toggleFullscreen());
        
        // Settings controls
        this.elements.ballCount.addEventListener('input', (e) => {
            this.elements.ballCountValue.textContent = e.target.value;
        });
        
        this.elements.sensitivity.addEventListener('input', (e) => {
            this.elements.sensitivityValue.textContent = parseFloat(e.target.value).toFixed(1);
        });
        
        this.elements.smoothing.addEventListener('input', (e) => {
            this.elements.smoothingValue.textContent = parseFloat(e.target.value).toFixed(1);
        });
        
        // Close modal when clicking outside
        window.addEventListener('click', (e) => {
            if (e.target === this.elements.settingsModal) {
                this.closeSettings();
            }
        });
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeSettings();
            }
            if (e.key === 'f' || e.key === 'F') {
                this.toggleFullscreen();
            }
            if (e.key === ' ' && document.activeElement.tagName !== 'INPUT') {
                e.preventDefault();
                this.toggleMicrophone();
            }
        });
    }

    // Initialize canvas and context
    initializeCanvas() {
        this.state.canvas = this.elements.canvas;
        this.state.ctx = this.state.canvas.getContext('2d');
        
        // Set canvas size to match container
        this.resizeCanvas();
    }

    // Handle window resize
    setupResizeHandler() {
        window.addEventListener('resize', () => this.resizeCanvas());
    }

    // Resize canvas to fit container
    resizeCanvas() {
        const container = this.state.canvas.parentElement;
        this.state.canvas.width = container.clientWidth;
        this.state.canvas.height = container.clientHeight;
        
        // Adjust ball positions if canvas was resized
        this.state.balls.forEach(ball => {
            if (ball.x > this.state.canvas.width) ball.x = this.state.canvas.width - ball.size;
            if (ball.y > this.state.canvas.height) ball.y = this.state.canvas.height - ball.size;
        });
    }

    // Initialize bouncing balls
    initializeBalls() {
        for (let i = 0; i < this.config.animation.ballCount; i++) {
            this.state.balls.push(this.createBall());
        }
        
        // Start animation loop
        this.animate();
    }

    // Create a new ball with random properties
    createBall() {
        const canvas = this.state.canvas;
        const size = Math.random() * 20 + 10; // 10-30px
        
        return {
            x: Math.random() * (canvas.width - size * 2) + size,
            y: Math.random() * (canvas.height - size * 2) + size,
            vx: (Math.random() - 0.5) * 2,
            vy: (Math.random() - 0.5) * 2,
            size: size,
            color: this.getRandomColor(),
            mass: size / 10, // Mass proportional to size
            trail: [] // For motion blur effect
        };
    }

    // Generate random bright color
    getRandomColor() {
        const colors = [
            '#FF6B6B', '#4ECDC4', '#FFE66D', '#FF9F43', 
            '#5F27CD', '#00D2D3', '#FF9FFC', '#F368E0',
            '#1DD1A1', '#FF6F91', '#845EC2', '#00C9A7'
        ];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    // Toggle microphone listening
    async toggleMicrophone() {
        if (this.state.isListening) {
            this.stopMicrophone();
        } else {
            await this.startMicrophone();
        }
    }

    // Start microphone and audio analysis
    async startMicrophone() {
        try {
            // Request microphone permission
            const stream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false
                } 
            });
            
            this.state.microphoneStream = stream;
            
            // Create audio context
            this.state.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.state.analyserNode = this.state.audioContext.createAnalyser();
            
            // Connect microphone to analyser
            const microphone = this.state.audioContext.createMediaStreamSource(stream);
            microphone.connect(this.state.analyserNode);
            
            // Configure analyser
            this.state.analyserNode.fftSize = 2048;
            this.state.analyserNode.smoothingTimeConstant = this.config.animation.smoothing;
            
            this.state.isListening = true;
            this.elements.startBtn.classList.add('listening');
            this.elements.startBtn.innerHTML = '<span class="btn-icon">⏹️</span><span class="btn-text">Өлшеуді тоқтату</span>';
            
            // Start audio analysis loop
            this.analyzeAudio();
            
            this.showStatusMessage('Микрофон іске қосылды. Шу деңгейі өлшенуде.', 'success');
            
        } catch (error) {
            console.error('Microphone access error:', error);
            this.handleMicrophoneError(error);
        }
    }

    // Handle microphone permission errors
    handleMicrophoneError(error) {
        let message = 'Микрофонды қосу кезінде қате орын алды.';
        
        if (error.name === 'PermissionDeniedError') {
            message = 'Микрофон қол жеткізбейді. Рұқсатын беру үшін браузер параметрлерін тексеріңіз.';
        } else if (error.name === 'NotFoundError') {
            message = 'Микрофон табылмады. құрылғыңызда микрофон барын тексеріңіз.';
        } else if (error.name === 'NotSupportedError') {
            message = 'Браузеріңіз микрофонды қолдамайды.';
        }
        
        this.showStatusMessage(message, 'error');
    }

    // Stop microphone and audio analysis
    stopMicrophone() {
        if (this.state.microphoneStream) {
            this.state.microphoneStream.getTracks().forEach(track => track.stop());
        }
        
        if (this.state.audioContext) {
            this.state.audioContext.close();
        }
        
        this.state.isListening = false;
        this.elements.startBtn.classList.remove('listening');
        this.elements.startBtn.innerHTML = '<span class="btn-icon">🎤</span><span class="btn-text">Микрофонды іске қосу</span>';
        
        this.showStatusMessage('Микрофон тоқтатылды.', 'info');
    }

    // Analyze audio data from microphone
    analyzeAudio() {
        if (!this.state.isListening || !this.state.analyserNode) return;
        
        const bufferLength = this.state.analyserNode.frequencyBinCount;
        const imageData = new Uint8Array(bufferLength);
        this.state.analyserNode.getByteTimeDomainData(imageData);
        
        // Calculate RMS (Root Mean Square) for volume measurement
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
            const sample = (imageData[i] - 128) / 128; // Normalize to -1 to 1
            sum += sample * sample;
        }
        
        const rms = Math.sqrt(sum / bufferLength);
        
        // Convert RMS to approximate dB value
        const rawDb = this.rmsToDb(rms);
        
        // Apply calibration offset
        this.state.currentDb = Math.max(0, rawDb + this.config.audio.calibrationOffset);
        
        // Smooth the value to prevent wild fluctuations
        this.state.smoothedDb += (this.state.currentDb - this.state.smoothedDb) * (1 - this.config.animation.smoothing);
        
        // Update noise level display
        this.updateNoiseDisplay();
        
        // Update ball animation based on noise level
        this.updateBallsAnimation();
        
        // Continue analysis loop
        requestAnimationFrame(() => this.analyzeAudio());
    }

    // Convert RMS value to approximate decibels
    rmsToDb(rms) {
        // Convert RMS (0-1) to dB scale
        // This is an approximation for visualization purposes
        const db = 20 * Math.log10(rms + 0.0001); // Add small value to avoid -Infinity
        // Map to a more intuitive range for classroom noise (20-100 dB)
        return Math.max(this.config.audio.minDb, Math.min(this.config.audio.maxDb, db + 60));
    }

    // Update noise level display and status
    updateNoiseDisplay() {
        const db = Math.round(this.state.smoothedDb);
        
        // Update numeric display
        this.elements.noiseValue.textContent = `${db} дБ`;
        
        // Update status message based on thresholds
        this.updateNoiseStatus(db);
        
        // Update progress bar
        const percentage = Math.min(100, (db / this.config.audio.maxDb) * 100);
        this.elements.noiseFill.style.width = `${percentage}%`;
        
        // Update status color
        this.updateStatusColor(db);
        
        // Add to history
        this.state.noiseHistory.push(db);
        if (this.state.noiseHistory.length > this.state.maxHistoryLength) {
            this.state.noiseHistory.shift();
        }
        
        // Update graph and statistics
        this.updateHistoryGraph();
        this.updateStatistics();
    }

    // Update noise status message based on dB level
    updateNoiseStatus(db) {
        const thresholds = this.config.noiseThresholds;
        let status = '';
        let message = '';
        
        if (db < thresholds.quiet) {
            status = 'Тыныш';
        } else if (db < thresholds.normal) {
            status = 'Қалыпты';
        } else if (db < thresholds.warning) {
            status = 'Назар аудар!';
            message = 'Назар аударыңыз! Шу деңгейі өте жоғары.';
        } else if (db < thresholds.caution) {
            status = 'Тшш... Тынышырақ!';
            message = 'Тшш... Сыныпта тыныштық сақтайық!';
        } else {
            status = 'ӨТЕ ҚАТТЫ!';
            message = 'Назар аударыңыз! Шу деңгейі өте жоғары.';
        }
        
        this.elements.noiseStatus.textContent = status;
        
        // Show warning message if needed
        if (message) {
            // Track when noise becomes high
            if (db >= thresholds.warning && !this.state.highNoiseStartTime) {
                this.state.highNoiseStartTime = Date.now();
            } else if (db < thresholds.warning) {
                this.state.highNoiseStartTime = null;
            }
            
            // Show message if noise stays high for several seconds
            if (db >= thresholds.caution && this.state.highNoiseStartTime) {
                const duration = (Date.now() - this.state.highNoiseStartTime) / 1000;
                if (duration > 3) { // Show after 3 seconds
                    this.showStatusMessage(message, 'warning');
                    this.state.highNoiseStartTime = null; // Reset to avoid spam
                }
            } else if (db >= thresholds.warning) {
                this.showStatusMessage(message, 'warning');
            }
        }
    }

    // Update status text color based on noise level
    updateStatusColor(db) {
        const statusElement = this.elements.noiseStatus;
        const noiseValueElement = this.elements.noiseValue;
        
        statusElement.classList.remove('quiet', 'normal', 'warning', 'danger');
        noiseValueElement.classList.remove('quiet', 'normal', 'warning', 'danger');
        
        if (db < this.config.noiseThresholds.quiet) {
            statusElement.classList.add('quiet');
            noiseValueElement.classList.add('quiet');
        } else if (db < this.config.noiseThresholds.normal) {
            statusElement.classList.add('normal');
            noiseValueElement.classList.add('normal');
        } else if (db < this.config.noiseThresholds.warning) {
            statusElement.classList.add('warning');
            noiseValueElement.classList.add('warning');
        } else {
            statusElement.classList.add('danger');
            noiseValueElement.classList.add('danger');
        }
    }

    // Update ball animation based on noise level
    updateBallsAnimation() {
        const db = this.state.smoothedDb;
        const thresholds = this.config.noiseThresholds;
        
        // Calculate energy factor based on noise level
        let energyFactor;
        if (db < thresholds.quiet) {
            energyFactor = 0.3; // Calm movement
        } else if (db < thresholds.normal) {
            energyFactor = 0.6; // Moderate movement
        } else if (db < thresholds.warning) {
            energyFactor = 1.0; // Energetic movement
        } else if (db < thresholds.caution) {
            energyFactor = 1.5; // Very energetic
        } else {
            energyFactor = 2.0; // Intense movement
        }
        
        // Apply sensitivity setting
        energyFactor *= this.config.animation.sensitivity;
        
        // Update each ball's velocity based on energy factor
        this.state.balls.forEach(ball => {
            // Increase velocity magnitude based on noise level
            const currentSpeed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
            const targetSpeed = currentSpeed * energyFactor;
            
            if (currentSpeed > 0) {
                ball.vx = (ball.vx / currentSpeed) * targetSpeed;
                ball.vy = (ball.vy / currentSpeed) * targetSpeed;
            }
            
            // Add some random variation for natural movement
            ball.vx += (Math.random() - 0.5) * 0.2 * energyFactor;
            ball.vy += (Math.random() - 0.5) * 0.2 * energyFactor;
        });
    }

    // Main animation loop
    animate(currentTime = 0) {
        const ctx = this.state.ctx;
        const canvas = this.state.canvas;
        
        // Calculate delta time
        const deltaTime = currentTime - this.state.lastTime;
        this.state.lastTime = currentTime;
        
        // Clear canvas with slight transparency for motion blur effect
        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Update and draw balls
        this.updateBalls(deltaTime);
        this.drawBalls(ctx);
        
        // Continue animation loop
        this.state.animationId = requestAnimationFrame((time) => this.animate(time));
    }

    // Update ball positions and handle collisions
    updateBalls(deltaTime) {
        const canvas = this.state.canvas;
        
        this.state.balls.forEach(ball => {
            // Store previous position for trail effect
            ball.trail.push({x: ball.x, y: ball.y});
            if (ball.trail.length > 5) {
                ball.trail.shift();
            }
            
            // Update position
            ball.x += ball.vx;
            ball.y += ball.vy;
            
            // Wall collisions with energy loss
            if (ball.x - ball.size < 0) {
                ball.x = ball.size;
                ball.vx = -ball.vx * 0.9; // Energy loss on bounce
            } else if (ball.x + ball.size > canvas.width) {
                ball.x = canvas.width - ball.size;
                ball.vx = -ball.vx * 0.9;
            }
            
            if (ball.y - ball.size < 0) {
                ball.y = ball.size;
                ball.vy = -ball.vy * 0.9;
            } else if (ball.y + ball.size > canvas.height) {
                ball.y = canvas.height - ball.size;
                ball.vy = -ball.vy * 0.9;
            }
        });
        
        // Handle ball-to-ball collisions
        this.handleBallCollisions();
    }

    // Handle collisions between balls
    handleBallCollisions() {
        for (let i = 0; i < this.state.balls.length; i++) {
            for (let j = i + 1; j < this.state.balls.length; j++) {
                const ballA = this.state.balls[i];
                const ballB = this.state.balls[j];
                
                const dx = ballB.x - ballA.x;
                const dy = ballB.y - ballA.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < ballA.size + ballB.size) {
                    // Balls are colliding
                    this.resolveCollision(ballA, ballB, dx, dy, distance);
                }
            }
        }
    }

    // Resolve collision between two balls using physics
    resolveCollision(ballA, ballB, dx, dy, distance) {
        // Normal vector
        const nx = dx / distance;
        const ny = dy / distance;
        
        // Relative velocity
        const dvx = ballB.vx - ballA.vx;
        const dvy = ballB.vy - ballA.vy;
        
        // Relative velocity along normal
        const dvn = dvx * nx + dvy * ny;
        
        // Only resolve if balls are moving towards each other
        if (dvn > 0) return;
        
        // Impulse calculation (assuming elastic collision)
        const e = 0.8; // Coefficient of restitution
        const impulse = -(1 + e) * dvn / (1/ballA.mass + 1/ballB.mass);
        
        // Apply impulse
        ballA.vx -= (impulse / ballA.mass) * nx;
        ballA.vy -= (impulse / ballA.mass) * ny;
        ballB.vx += (impulse / ballB.mass) * nx;
        ballB.vy += (impulse / ballB.mass) * ny;
    }

    // Draw all balls on canvas
    drawBalls(ctx) {
        this.state.balls.forEach(ball => {
            // Draw trail
            ball.trail.forEach((point, index) => {
                const alpha = index / ball.trail.length;
                ctx.beginPath();
                ctx.arc(point.x, point.y, ball.size * alpha, 0, Math.PI * 2);
                ctx.fillStyle = ball.color.replace(')', `,${alpha * 0.3})`).replace('rgb', 'rgba');
                ctx.fill();
            });
            
            // Draw ball with shadow and highlight
            ctx.save();
            
            // Shadow
            ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
            ctx.shadowBlur = 10;
            ctx.shadowOffsetX = 3;
            ctx.shadowOffsetY = 3;
            
            // Ball body
            ctx.beginPath();
            ctx.arc(ball.x, ball.y, ball.size, 0, Math.PI * 2);
            
            // Gradient fill for 3D effect
            const gradient = ctx.createRadialGradient(
                ball.x - ball.size/3, ball.y - ball.size/3, ball.size/4,
                ball.x, ball.y, ball.size
            );
            gradient.addColorStop(0, '#ffffff');
            gradient.addColorStop(0.3, ball.color);
            gradient.addColorStop(1, this.darkenColor(ball.color));
            
            ctx.fillStyle = gradient;
            ctx.fill();
            
            // Highlight
            ctx.shadowColor = 'transparent';
            ctx.beginPath();
            ctx.arc(ball.x - ball.size/3, ball.y - ball.size/3, ball.size/3, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
            ctx.fill();
            
            ctx.restore();
        });
    }

    // Darken a color for 3D effect
    darkenColor(hexColor) {
        // Simple color darkening (for demonstration)
        const r = parseInt(hexColor.slice(1, 3), 16);
        const g = parseInt(hexColor.slice(3, 5), 16);
        const b = parseInt(hexColor.slice(5, 7), 16);
        
        return `rgb(${r * 0.7}, ${g * 0.7}, ${b * 0.7})`;
    }

    // Update noise history graph
    updateHistoryGraph() {
        const canvas = this.elements.historyGraph;
        const ctx = canvas.getContext('2d');
        
        // Set canvas dimensions correctly
        canvas.width = canvas.clientWidth;
        canvas.height = canvas.clientHeight;
        
        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Draw grid
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 1;
        
        // Horizontal grid lines
        for (let i = 0; i <= 4; i++) {
            const y = (canvas.height / 4) * i;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(canvas.width, y);
            ctx.stroke();
        }
        
        // Draw data line
        if (this.state.noiseHistory.length > 1) {
            ctx.beginPath();
            ctx.strokeStyle = '#4ECDC4';
            ctx.lineWidth = 2;
            
            const stepX = canvas.width / (this.state.maxHistoryLength - 1);
            
            for (let i = 0; i < this.state.noiseHistory.length; i++) {
                const x = i * stepX;
                const y = canvas.height - (this.state.noiseHistory[i] / this.config.audio.maxDb) * canvas.height;
                
                if (i === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
            }
            
            ctx.stroke();
            
            // Fill under the line
            ctx.lineTo(canvas.width, canvas.height);
            ctx.lineTo(0, canvas.height);
            ctx.closePath();
            ctx.fillStyle = 'rgba(78, 205, 196, 0.1)';
            ctx.fill();
        }
    }

    // Update statistics display
    updateStatistics() {
        if (this.state.noiseHistory.length === 0) return;
        
        const min = Math.min(...this.state.noiseHistory);
        const max = Math.max(...this.state.noiseHistory);
        const avg = this.state.noiseHistory.reduce((a, b) => a + b, 0) / this.state.noiseHistory.length;
        
        this.elements.minValue.textContent = `${Math.round(min)} дБ`;
        this.elements.avgValue.textContent = `${Math.round(avg)} дБ`;
        this.elements.maxValue.textContent = `${Math.round(max)} дБ`;
    }

    // Reset statistics and history
    resetStatistics() {
        this.state.noiseHistory = [];
        this.elements.minValue.textContent = '0 дБ';
        this.elements.avgValue.textContent = '0 дБ';
        this.elements.maxValue.textContent = '0 дБ';
        
        this.showStatusMessage('Статистика тазаланды.', 'info');
    }

    // Open settings modal
    openSettings() {
        // Update settings values in modal
        this.elements.ballCount.value = this.config.animation.ballCount;
        this.elements.ballCountValue.textContent = this.config.animation.ballCount;
        this.elements.sensitivity.value = this.config.animation.sensitivity;
        this.elements.sensitivityValue.textContent = this.config.animation.sensitivity.toFixed(1);
        this.elements.smoothing.value = this.config.animation.smoothing;
        this.elements.smoothingValue.textContent = this.config.animation.smoothing.toFixed(1);
        this.elements.calibration.value = this.config.audio.calibrationOffset;
        this.elements.showGraph.checked = true; // This would be saved in a real app
        
        this.elements.settingsModal.style.display = 'flex';
    }

    // Close settings modal
    closeSettings() {
        this.elements.settingsModal.style.display = 'none';
    }

    // Save settings
    saveSettings() {
        this.config.animation.ballCount = parseInt(this.elements.ballCount.value);
        this.config.animation.sensitivity = parseFloat(this.elements.sensitivity.value);
        this.config.animation.smoothing = parseFloat(this.elements.smoothing.value);
        this.config.audio.calibrationOffset = parseInt(this.elements.calibration.value);
        
        // Update ball count if changed
        this.updateBallCount();
        
        // Update analyser smoothing if listening
        if (this.state.isListening && this.state.analyserNode) {
            this.state.analyserNode.smoothingTimeConstant = this.config.animation.smoothing;
        }
        
        this.saveSettingsToStorage();
        this.closeSettings();
        this.showStatusMessage('Параметрлер сақталды.', 'success');
    }

    // Update ball count when changed
    updateBallCount() {
        const currentCount = this.state.balls.length;
        const targetCount = this.config.animation.ballCount;
        
        if (targetCount > currentCount) {
            // Add new balls
            for (let i = currentCount; i < targetCount; i++) {
                this.state.balls.push(this.createBall());
            }
        } else if (targetCount < currentCount) {
            // Remove excess balls
            this.state.balls.splice(targetCount);
        }
    }

    // Reset settings to defaults
    resetSettings() {
        this.config = {
            noiseThresholds: {
                quiet: 40,
                normal: 60,
                warning: 70,
                caution: 80,
                loud: 100
            },
            animation: {
                ballCount: 30,
                sensitivity: 1.0,
                smoothing: 0.3
            },
            audio: {
                calibrationOffset: 0,
                minDb: 20,
                maxDb: 100
            }
        };
        
        this.saveSettingsToStorage();
        this.openSettings(); // Reopen to show reset values
        this.showStatusMessage('Параметрлер әдепкі мәніне оралты.', 'info');
    }

    // Save settings to localStorage
    saveSettingsToStorage() {
        const settings = {
            config: this.config
        };
        localStorage.setItem('noiseVisualizerSettings', JSON.stringify(settings));
    }

    // Load settings from localStorage
    loadSettings() {
        const saved = localStorage.getItem('noiseVisualizerSettings');
        if (saved) {
            try {
                const settings = JSON.parse(saved);
                this.config = { ...this.config, ...settings.config };
            } catch (error) {
                console.error('Error loading settings:', error);
            }
        }
    }

    // Toggle fullscreen mode
    toggleFullscreen() {
        const element = document.body;
        
        if (!document.fullscreenElement) {
            // Enter fullscreen
            if (element.requestFullscreen) {
                element.requestFullscreen();
            } else if (element.webkitRequestFullscreen) {
                element.webkitRequestFullscreen();
            } else if (element.msRequestFullscreen) {
                element.msRequestFullscreen();
            }
            
            this.elements.fullscreenBtn.innerHTML = '✕ Жабу';
            document.body.classList.add('fullscreen');
        } else {
            // Exit fullscreen
            if (document.exitFullscreen) {
                document.exitFullscreen();
            } else if (document.webkitExitFullscreen) {
                document.webkitExitFullscreen();
            } else if (document.msExitFullscreen) {
                document.msExitFullscreen();
            }
            
            this.elements.fullscreenBtn.innerHTML = '⤢ Толық экран';
            document.body.classList.remove('fullscreen');
        }
    }

    // Show status message
    showStatusMessage(message, type = 'info') {
        // Clear previous timeout
        if (this.state.messageTimeout) {
            clearTimeout(this.state.messageTimeout);
        }
        
        // Create message element
        const messageElement = document.createElement('div');
        messageElement.className = `message ${type}`;
        messageElement.textContent = message;
        
        // Add to container
        this.elements.messageContainer.appendChild(messageElement);
        
        // Auto remove after 4 seconds
        this.state.messageTimeout = setTimeout(() => {
            messageElement.remove();
        }, 4000);
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new NoiseVisualizer();
});
