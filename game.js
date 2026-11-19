// Скрипт стоит в конце body, поэтому запускается сразу
// (без DOMContentLoaded — в окнах предпросмотра это событие часто не срабатывает).
(function () {
    'use strict';

    let W = 500, H = 500;
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    const menu = document.getElementById('setup-menu');
    const resultBox = document.getElementById('result');
    const resultText = document.getElementById('result-text');
    const playerControls = document.getElementById('player-controls');
    const joystickBase = document.getElementById('joystick-base');
    const joystickKnob = document.getElementById('joystick-knob');
    const playerMove = { x: 0, y: 0, active: false, pointerId: null };
    let playerCharacter = null;

    /* ---------------- ЗВУК ---------------- */
    let audioCtx = null;
    function initAudio() {
        try {
            if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            if (audioCtx.state === 'suspended') audioCtx.resume();
        } catch (e) {
            console.log('AudioContext not supported', e);
        }
    }

    function playLaserSound() {
        if (!audioCtx) return;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(350, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(120, audioCtx.currentTime + 0.25);
        gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
        gain.gain.linearRampToValueAtTime(0.01, audioCtx.currentTime + 0.25);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.25);
    }

    function playExplosionSound() {
        if (!audioCtx) return;
        const bufferSize = Math.floor(audioCtx.sampleRate * 0.4);
        const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
        const noise = audioCtx.createBufferSource();
        noise.buffer = buffer;
        const filter = audioCtx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(600, audioCtx.currentTime);
        filter.frequency.linearRampToValueAtTime(40, audioCtx.currentTime + 0.4);
        const gain = audioCtx.createGain();
        gain.gain.setValueAtTime(0.25, audioCtx.currentTime);
        gain.gain.linearRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(audioCtx.destination);
        noise.start();
    }

    function playCoughSound() {
        if (!audioCtx) return;
        const playBurst = (delay) => {
            setTimeout(() => {
                if (!audioCtx) return;
                const bufferSize = Math.floor(audioCtx.sampleRate * 0.12);
                const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
                const data = buffer.getChannelData(0);
                for (let i = 0; i < bufferSize; i++) {
                    data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.3));
                }
                const noise = audioCtx.createBufferSource();
                noise.buffer = buffer;
                const filter = audioCtx.createBiquadFilter();
                filter.type = 'bandpass';
                filter.frequency.setValueAtTime(350, audioCtx.currentTime);
                filter.Q.value = 4;
                const gain = audioCtx.createGain();
                gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
                gain.gain.linearRampToValueAtTime(0.01, audioCtx.currentTime + 0.12);
                noise.connect(filter);
                filter.connect(gain);
                gain.connect(audioCtx.destination);
                noise.start();
            }, delay);
        };
        playBurst(0);
        playBurst(140);
    }

    function playHitSound() {
        if (!audioCtx) return;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(220, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(90, audioCtx.currentTime + 0.08);
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gain.gain.linearRampToValueAtTime(0.01, audioCtx.currentTime + 0.08);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.08);
    }

    function playTimeStopSound() {
        if (!audioCtx) return;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(400, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(40, audioCtx.currentTime + 0.6);
        gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gain.gain.linearRampToValueAtTime(0.01, audioCtx.currentTime + 0.6);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.6);
    }

    function playChargeSound(sec) {
        if (!audioCtx) return;
        sec = sec || 1.3;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(70, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(900, audioCtx.currentTime + sec);
        gain.gain.setValueAtTime(0.02, audioCtx.currentTime);
        gain.gain.linearRampToValueAtTime(0.16, audioCtx.currentTime + sec);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + sec);
    }

    /* ---------------- БОЕВАЯ МУЗЫКА (Gojo vs Sukuna) ---------------- */
    // I'm Still Standing (Elton John) защищён авторским правом — встроить нельзя.
    // Если рядом с HTML лежит файл im-still-standing.mp3 — он будет использован.
    // Иначе играет синтезированный тёмный боевой трек.
    let battleBgmPlaying = false;
    let battleBgmNodes = [];
    let battleBgmInterval = null;
    let battleAudioEl = null;
    let battleMusicMode = 'none'; // 'file' | 'synth' | 'none'

    function stopBattleMusic() {
        if (battleBgmInterval) {
            clearInterval(battleBgmInterval);
            battleBgmInterval = null;
        }
        battleBgmNodes.forEach(function (n) {
            try { n.stop(); } catch (e) {}
            try { n.disconnect(); } catch (e) {}
        });
        battleBgmNodes = [];
        if (battleAudioEl) {
            try {
                battleAudioEl.pause();
                battleAudioEl.currentTime = 0;
            } catch (e) {}
        }
        battleBgmPlaying = false;
        battleMusicMode = 'none';
    }

    function startSynthBattleMusic() {
        if (!audioCtx || battleBgmPlaying) return;
        battleBgmPlaying = true;
        battleMusicMode = 'synth';

        const master = audioCtx.createGain();
        master.gain.value = 0.11;
        master.connect(audioCtx.destination);

        // басовый пульс
        function pulse() {
            if (!battleBgmPlaying || !audioCtx) return;
            const t = audioCtx.currentTime;
            const osc = audioCtx.createOscillator();
            const g = audioCtx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(55, t);
            osc.frequency.exponentialRampToValueAtTime(40, t + 0.18);
            g.gain.setValueAtTime(0.7, t);
            g.gain.exponentialRampToValueAtTime(0.01, t + 0.22);
            osc.connect(g);
            g.connect(master);
            osc.start(t);
            osc.stop(t + 0.23);
            battleBgmNodes.push(osc);
        }

        // тёмный аккорд
        function darkChord() {
            if (!battleBgmPlaying || !audioCtx) return;
            const t = audioCtx.currentTime;
            const freqs = [110, 138.59, 164.81]; // m-ish
            freqs.forEach(function (f, i) {
                const osc = audioCtx.createOscillator();
                const g = audioCtx.createGain();
                osc.type = i === 0 ? 'sawtooth' : 'triangle';
                osc.frequency.value = f;
                g.gain.setValueAtTime(0.12, t);
                g.gain.linearRampToValueAtTime(0.08, t + 0.8);
                g.gain.linearRampToValueAtTime(0.01, t + 1.6);
                const filt = audioCtx.createBiquadFilter();
                filt.type = 'lowpass';
                filt.frequency.value = 600;
                osc.connect(filt);
                filt.connect(g);
                g.connect(master);
                osc.start(t);
                osc.stop(t + 1.65);
                battleBgmNodes.push(osc);
            });
        }

        // высокий «звон» как намёк на tension
        function tensionHit() {
            if (!battleBgmPlaying || !audioCtx) return;
            const t = audioCtx.currentTime;
            const osc = audioCtx.createOscillator();
            const g = audioCtx.createGain();
            osc.type = 'square';
            osc.frequency.setValueAtTime(880, t);
            osc.frequency.exponentialRampToValueAtTime(220, t + 0.4);
            g.gain.setValueAtTime(0.08, t);
            g.gain.exponentialRampToValueAtTime(0.01, t + 0.4);
            osc.connect(g);
            g.connect(master);
            osc.start(t);
            osc.stop(t + 0.42);
            battleBgmNodes.push(osc);
        }

        pulse();
        darkChord();
        let step = 0;
        battleBgmInterval = setInterval(function () {
            if (!battleBgmPlaying) return;
            pulse();
            step++;
            if (step % 4 === 0) darkChord();
            if (step % 8 === 0) tensionHit();
            // чистим старые ноды
            if (battleBgmNodes.length > 40) {
                battleBgmNodes = battleBgmNodes.slice(-20);
            }
        }, 280);
    }

    function tryStartBattleMusicFile(cb) {
        // пробуем локальный im-still-standing.mp3 рядом с HTML
        if (battleAudioEl) {
            cb(true);
            return;
        }
        const a = new Audio();
        a.src = 'im-still-standing.mp3';
        a.loop = true;
        a.volume = 0.45;
        let settled = false;
        const done = function (ok) {
            if (settled) return;
            settled = true;
            if (ok) {
                battleAudioEl = a;
                cb(true);
            } else {
                cb(false);
            }
        };
        a.addEventListener('canplaythrough', function () { done(true); });
        a.addEventListener('error', function () { done(false); });
        // таймаут на случай, если файл не найден
        setTimeout(function () { done(!!battleAudioEl); }, 1200);
        try { a.load(); } catch (e) { done(false); }
    }

    function startBattleMusic() {
        if (battleBgmPlaying) return;
        initAudio();
        tryStartBattleMusicFile(function (hasFile) {
            if (hasFile && battleAudioEl) {
                battleBgmPlaying = true;
                battleMusicMode = 'file';
                battleAudioEl.currentTime = 0;
                const p = battleAudioEl.play();
                if (p && p.catch) {
                    p.catch(function () {
                        // автоплей мог блокироваться — fallback на synth
                        battleBgmPlaying = false;
                        startSynthBattleMusic();
                    });
                }
            } else {
                startSynthBattleMusic();
            }
        });
    }

    function updateBattleMusic() {
        if (!running) {
            stopBattleMusic();
            return;
        }
        const hasGojo = balls.some(function (b) {
            return !b.out && b.type === 'gojo';
        });
        const hasSukuna = balls.some(function (b) {
            return !b.out && b.type === 'sukuna';
        });
        if (hasGojo && hasSukuna) {
            if (!battleBgmPlaying) startBattleMusic();
        } else {
            if (battleBgmPlaying) stopBattleMusic();
        }
    }

    /* ---------------- ВЫБОР БОЙЦОВ ---------------- */
    // Боец 3 необязателен: null = бой вдвоём
    let battleMode = '1v1'; // 1v1, 1v1v1, 2v2 или 2v1
    let chairForce = null;  // выбор кресла Мёбиуса для создаваемого шара: 'chair' | 'normal' | null (случайно 25%)
    function isTeamMode() { return battleMode === '2v2' || battleMode === '2v1'; }
    function isPact(a, b) {
        return (a.type === 'robot' && b.type === 'oneshot') || (a.type === 'oneshot' && b.type === 'robot') ||
            (a.type === 'goku' && b.type === 'vegeta') || (a.type === 'vegeta' && b.type === 'goku');
    }
    let fighters = [
        { type: 'blue', color: '#2196f3', name: 'Blue Ball' },
        { type: 'red', color: '#ff5252', name: 'Red Ball' },
        null,
        null
    ];

    // Четвёртый слот использует тот же список персонажей, что и второй.
    const slot2 = document.querySelector('[data-slot="2"]');
    const slot4 = slot2.cloneNode(true);
    slot4.setAttribute('data-slot', '4');
    slot4.querySelector('.team-heading').id = 'team-heading-4';
    slot4.querySelector('.team-heading').textContent = 'Team 2 — fighter 2';
    slot4.querySelectorAll('button').forEach(function (b) {
        b.className = b.className.replace(/f2-btn/g, 'f4-btn');
        b.setAttribute('data-fighter', '4');
        b.classList.remove('selected');
        b.setAttribute('data-type', b.getAttribute('data-type'));
    });
    document.getElementById('start-btn').before(slot4);

    function setBattleMode(mode) {
        battleMode = mode;
        const showThird = mode === '1v1v1' || mode === '2v2' || mode === '2v1' || mode === 'race';
        const showFourth = mode === '2v2';
        document.querySelector('[data-slot="3"]').style.display = showThird ? 'block' : 'none';
        slot4.style.display = showFourth ? 'block' : 'none';
        document.getElementById('mode-1v1v1').classList.toggle('active', mode === '1v1v1');
        document.getElementById('mode-2v2').classList.toggle('active', mode === '2v2');
        document.getElementById('mode-2v1').classList.toggle('active', mode === '2v1');
        document.getElementById('mode-race').classList.toggle('active', mode === 'race');
        document.getElementById('team-heading-1').textContent = (mode === '2v2' || mode === '2v1') ? 'Team 1 — fighter 1' : mode === 'race' ? 'Racer 1' : 'Fighter 1';
        document.getElementById('team-heading-2').textContent = (mode === '2v2' || mode === '2v1') ? 'Team 1 — fighter 2' : mode === 'race' ? 'Racer 2' : 'Fighter 2';
        document.getElementById('team-heading-3').textContent = mode === '2v2' ? 'Team 2 — fighter 1' : mode === '2v1' ? 'Team 2 — solo fighter' : mode === 'race' ? 'Racer 3 (optional)' : 'Fighter 3';
        document.getElementById('team-heading-4').textContent = 'Team 2 — fighter 2';
        document.getElementById('start-btn').textContent = mode === 'race' ? 'Start race!' : mode === '2v1' ? 'Start 2 vs 1 battle!' : mode === '2v2' ? 'Start 2v2 battle!' : mode === '1v1v1' ? 'Start 1v1v1 battle!' : 'Start battle!';
    }
    document.getElementById('mode-1v1v1').addEventListener('click', function () { setBattleMode('1v1v1'); });
    document.getElementById('mode-2v2').addEventListener('click', function () { setBattleMode('2v2'); });
    document.getElementById('mode-2v1').addEventListener('click', function () { setBattleMode('2v1'); });
    document.getElementById('mode-race').addEventListener('click', function () { setBattleMode(battleMode === 'race' ? '1v1' : 'race'); });
    setBattleMode('1v1');

    // Кресло Мёбиуса (Wally West и Roblox Egor): выбираем форму — «Random 25%», «Chair» или «Normal»
    const chairSel = ['random', 'random', 'random', 'random'];
    const CHAIR_OPTS = [['random', 'Random (25%)'], ['chair', 'Möbius Chair'], ['normal', 'Normal']];
    function chairRowOf(slotNum) { return document.querySelector('[data-slot="' + slotNum + '"] .chair-row'); }
    document.querySelectorAll('.fighter-group').forEach(function (g) {
        const slotNum = parseInt(g.getAttribute('data-slot'), 10);
        const row = document.createElement('div');
        row.className = 'chair-row';
        row.appendChild(document.createTextNode('Form: '));
        CHAIR_OPTS.forEach(function (o) {
            const cb = document.createElement('button');
            cb.className = 'chair-btn' + (o[0] === 'random' ? ' selected' : '');
            cb.textContent = o[1];
            cb.setAttribute('data-chair', o[0]);
            cb.addEventListener('click', function () {
                chairSel[slotNum - 1] = o[0];
                row.querySelectorAll('.chair-btn').forEach(function (x) { x.classList.toggle('selected', x === cb); });
            });
            row.appendChild(cb);
        });
        g.appendChild(row);
    });
    function updateChairRows() {
        for (let i = 0; i < 4; i++) {
            const row = chairRowOf(i + 1);
            const f = fighters[i];
            if (row) row.style.display = (f && (f.type === 'wally' || f.type === 'egor')) ? 'block' : 'none';
        }
    }

    function selectFighter(fighterNum, type, color, name, btnElement) {
        fighters[fighterNum - 1] = (type === 'none') ? null : { type: type, color: color, name: name };
        document.querySelectorAll('.f' + fighterNum + '-btn').forEach(function (b) { b.classList.remove('selected'); });
        if (btnElement) btnElement.classList.add('selected');
        updateChairRows();
    }

    document.querySelectorAll('.fighter-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
            selectFighter(
                parseInt(btn.getAttribute('data-fighter'), 10),
                btn.getAttribute('data-type'),
                btn.getAttribute('data-color'),
                btn.getAttribute('data-name'),
                btn
            );
        });
    });

    document.getElementById('start-btn').addEventListener('click', startBattle);
    document.getElementById('rematch-btn').addEventListener('click', startBattle);
    document.getElementById('menu-btn').addEventListener('click', function () {
        stopBattleMusic();
        resultBox.style.display = 'none';
        canvas.style.display = 'none';
        playerControls.style.display = 'none';
        playerCharacter = null;
        menu.style.display = 'block';
        document.querySelectorAll('.mode-switch').forEach(function (b) { b.style.display = 'block'; });
    });

    /* ---------------- СОСТОЯНИЕ ИГРЫ ---------------- */
    class FloatingText {
        constructor(x, y, text, color) {
            this.x = x;
            this.y = y;
            this.text = text;
            this.color = color || '255, 215, 0';
            this.alpha = 1;
            this.life = 45;
        }
        update() {
            this.y -= 0.6;
            this.alpha = Math.max(0, this.alpha - 1 / 45);
            this.life--;
        }
        draw() {
            ctx.fillStyle = 'rgba(' + this.color + ', ' + this.alpha + ')';
            ctx.font = 'bold 14px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(this.text, this.x, this.y);
        }
    }

    let balls = [];
    let arenaBroken = false, arenaFx = 0, arenaBreakT = 0, arenaCracks = [], viewZoom = 1, punchSeq = 0, cutscene = null, kokuScene = null, peaceT = 0;
    let floatingTexts = [];
    let timeStopOwner = null;
    let timeStopTimer = 0;
    let contactCooldown = 0;
    let blastTimer = 0;
    let blastX = 0;
    let blastY = 0;
    let blastCharge = 0;      // кадров накопления энергии до взрыва
    let blastBalls = [];      // шары, чьи лучи столкнулись
    let blastChargeMax = 80;  // длина накопления для текущего взрыва
    let blastKind = null;     // вид текущего взрыва (см. BLAST_KINDS)
    let clashRolled = {};     // для каждой пары лучей кубик кидается один раз
    let domainClash = null;   // идущее столкновение доменов { a, b, t, bar, ... }
    let clashFlash = 0;       // вспышка после столкновения доменов
    let clashFlashX = 0, clashFlashY = 0, clashFlashColor = '255, 255, 255';
    let running = false;
    let rafId = null;

    const TIME_STOP_DURATION = 300; // верхний предел; обычно стоп кончается после 10 ударов
    const TIME_STOP_HITS = 10;
    const TIME_STOP_HIT_DAMAGE = 5;

    // Ульта Красного и Синего: каждая вторая лазерная атака
    const ULT_EVERY = 400;     // «кадров движения» между ультами (обычный лазер раз в 280)
    const ULT_CHARGE = 130;    // зарядка ульты (обычный лазер — 90)
    const ULT_FRAMES = 90;     // длительность луча ульты
    const ULT_DAMAGE = 50;     // сколько HP сносит ульта, если враг всё время в луче
    const ULT_LEN = 240;       // длина луча (обычный — 150)
    const ULT_WIDTH = 56;      // ширина луча (обычный — 35)

    function startTimeStop(ball) {
        timeStopOwner = ball;
        timeStopTimer = TIME_STOP_DURATION;
        ball.dx = 0;
        ball.dy = 0;
        ball.hitDelay = 0;
        ball.stopHitsLeft = TIME_STOP_HITS;
        playTimeStopSound();
    }

    /* ---------------- ШАР ---------------- */
    class Ball {
        constructor(x, y, color, type, name, label) {
            this.x = x;
            this.y = y;
            this.dx = 0;
            this.dy = 0;
            this.radius = 20;
            this.color = color;
            this.type = type;
            this.name = name;
            this.label = label;
            this.hp = 100;
            this.playerLaserOn = false;

            // лазер (синий / красный)
            this.abilityTimer = 0;
            this.cooldownTimer = 0;
            this.isCharging = false;
            this.chargeTimer = 0;
            this.isUsingAbility = false;
            this.targetAngle = 0;

            // зелёный
            this.healTimer = 0;
            this.damageAuraTimer = 0;

            // анти-шар
            this.antiActive = false;
            this.antiTimer = 0;
            this.antiCooldown = 0;

            // one shot
            this.isOneShotCharging = false;
            this.oneShotChargeTimer = 0;
            this.oneShotCooldown = 0;
            this.strikeTimer = 0;
            this.ghostX = 0;
            this.ghostY = 0;
            this.ghostTimer = 0;

            this.stunTimer = 0;

            // SCP-096
            this.isRaging = false;
            this.rageTimer = 0;
            this.rageCooldown = 0;
            this.comboHitsLeft = 0;
            this.comboDelay = 0;

            // автор
            this.isAuthorCharging = false;
            this.authorChargeTimer = 0;
            this.authorCooldown = 0;
            this.hitDelay = 0;
            this.reviveUsed = false;
            this.isFakeDead = false;
            this.fakeDeathTimer = 0;
            this.skill = null;
            this.skillPhase = '';
            this.skillTimer = 0;
            this.authorChargeMax = 90;
            this.eraseReadyTimer = 0;
            this.sealed = false;
            this.erased = false;
            this.eraseTimer = 0;

            // Prism Ball
            this.energy = 0;
            this.beamOn = false;
            this.beamTimer = 0;
            this.lensAngle = 0;
            this.focusPhase = '';
            this.focusTimer = 0;
            this.focusCooldown = 0;
            this.focusTarget = null;
            this.heat = 0;
            this.holos = [];

            // ульта Красного / Синего
            this.isUlt = false;
            this.ultTimer = 0;
            this.holdTimer = 0;        // стартовая пауза (лазерный треугольник)

            // Муха 2
            this.snapTimer = 0;
            this.snapCooldown = 210; // ~3.5 сек при 60 fps

            // Годжо
            this.gojoPurpleTimer = 0;
            this.gojoPurpleCooldown = 0;
            this.isPurpleCharging = false;
            this.purpleChargeTimer = 0;
            this.purpleBall = null;    // снаряд Hollow Purple (шар)
            this.domainTimer = 0;
            this.domainActive = false;
            this.domainCooldown = 0;     // перезарядка домена 6.5 сек

            // Сукуна / Мегуна
            this.cleaveTimer = 0;
            this.domainSukunaTimer = 0;
            this.domainSukunaActive = false;
            this.dismantleTimer = 0;
            this.isMeguna = false;

            // Мегуми
            this.shadowTimer = 0;
            this.mahoragaTimer = 0;
            this.mahoragaActive = false;
            this.mahoragaBall = null;  // ссылка на призванного Махорагу

            // Махорага
            this.adaptation = 0;       // общий уровень адаптации
            this.owner = null;         // для Махораги — кто призвал
            this.adaptHits = {};       // счётчик попаданий по типу приёма
            this.adaptedTo = {};       // к каким приёмам уже адаптирован

            // Реверсивная техника (RCT) для персонажей из магической битвы
            this.rctTimer = 0;

            // Рю — Гранитный выстрел (луч)
            this.graniteTimer = 0;
            this.graniteCooldown = 0;
            this.graniteBeam = false;
            this.graniteBeamTimer = 0;
            this.beamPower = 1; // сила луча для битвы лучей

            // Юта — копирование + луч проклятой энергии
            this.copyTimer = 0;
            this.copiedSkill = null;   // тип скопированного приёма
            this.copyUses = 0;
            this.yutaBeam = false;
            this.yutaBeamTimer = 0;
            this.yutaBeamCooldown = 0;
            this.seenSkills = {};      // какие приёмы видел
            // Юта: меч + ульта «Рика» (HP < 50, один раз)
            this.yUltUsed = false; this.yUltT = 0; this.ySwordCd = 40; this.ySwingT = 0; this.ySwingAng = 0;
            // Юджи Итадори: кулаки, Расходящийся кулак, Чёрная вспышка
            this.yjCd = 30; this.yjPunchT = 0; this.yjAng = 0; this.yjZone = 0; this.yjFlash = 0;
            this.yjDelay = 0; this.yjDelayTarget = null; this.yjDelayDmg = 0;
            this.yjChain = 0; this.yjZoneMode = 0; this.yjKoku = 0;
            // Гоку: Камехамеха, Мгновенное перемещение, Ультра Инстинкт (0 → знак → мастер)
            this.gkUI = 0; this.gkMax = 0; this.gkPunchCd = 30; this.gkCd = 150; this.gkItCd = 100;
            this.gkPunchT = 0; this.gkAng = 0; this.gkKame = 0; this.gkBeamT = 0; this.gkBx = 0; this.gkBy = 0;
            this.gkPow = false; this.gkRival = false; this.vgRival = false; this.gkRage = false; this.pactAvenged = false;
            // Гоку Блэк: бессмертие Замасу, энергетическая коса, Супер Сайян Роз
            this.gbForm = 0; this.gbMax = 0; this.gbPunchCd = 30; this.gbSlashCd = 60; this.gbBeamCd = 150;
            this.gbSlashT = 0; this.gbAng = 0; this.gbCharge = 0; this.gbChargeMax = 1; this.gbBeamT = 0;
            this.gbFlash = 0; this.gbRevived = false; this.gbCombo = 0;
            // Вегета: Галик Ган, Финальная вспышка, Ультра Эго (0 → SSB → Ультра Эго)
            this.vgForm = 0; this.vgMax = 0; this.vgPunchCd = 30; this.vgCd = 140; this.vgFfCd = 260;
            this.vgPunchT = 0; this.vgAng = 0; this.vgCharge = 0; this.vgChargeMax = 1; this.vgChargeType = '';
            this.vgBeamT = 0; this.vgBeamType = ''; this.vgFlash = 0; this.vgStacks = 0; this.vgCombo = 0;
            this.gkFlash = 0; this.gkDodgeCd = 0; this.gkGhost = null; this.gkCombo = 0;
            // Аои Тодо: Буги-Вуги (хлопок меняет места)
            this.tdCd = 90; this.tdPunchCd = 30; this.tdClapFx = 0; this.tdPunchT = 0; this.tdAng = 0;

            // Наоя Дзэнин — Проекция (24 кадра в секунду)
            this.naoyaCd = 100;        // кадров до следующего рывка
            this.naoyaPhase = '';      // '' | 'aim' | 'dash' | 'combo'
            this.blackFlashFleeTimer = 0; // время бегства от Чёрного Флэша
            this.blackFlashEscaped = false;
            this.naoyaTimer = 0;
            this.naoyaTarget = null;
            this.afterimages = [];     // остаточные образы рывка
            this.frameRing = 0;        // вращение «киноплёнки»

            // Простой домен (защита бойцов из магической битвы от чужого домена)
            this.simpleActive = false;
            this.simpleT = 0;
            this.simpleHp = 0;         // прочность барьера
            this.simpleCd = 0;         // перезарядка

            // Бог времени
            this.tgCd1 = 330;          // Застывшее время: набирается до 330 (первое — сразу)
            this.tgCd2 = 200;          // Вязкое время: набирается до 300
            this.tgCd3 = 0;            // Перемотка: обратный отсчёт
            this.tgPhase = '';         // '' | 'stop'
            this.tgTimer = 0;
            this.tgHits = 0;           // сколько ударов накоплено
            this.tgBank = 0;           // накопленный урон, обрушится при возобновлении времени
            this.tgTarget = null;
            this.zoneT = 0;            // сколько ещё держится поле замедления
            this.hist = [];            // снимки для перемотки
            this.histT = 0;
            this.clockAng = 0;
            this.rewindFx = 0;
            this.slowT = 0;            // замедлен полем (может быть у любого шара)
            this.px = 0;
            this.py = 0;

            // Уолли Уэст
            this.wSpeed = WALLY_BASE;  // текущая скорость, px за кадр
            this.wSpeedT = 0;
            this.wSpin = 0;            // вращение ленты Мёбиуса
            this.wHealT = 0;
            this.wPhase = '';          // '' | 'flurry' | 'mass' | 'lunge'
            this.wKind = 0;            // 1 = шквал после телепорта, 3 = обычный шквал
            this.wTimer = 0;
            this.wHitsDone = 0;
            this.wAng = 0;
            this.wTarget = null;
            this.wCd1 = 200;           // телепорт + шквал
            this.wCd2 = 500;           // бесконечная масса
            this.wCd3 = 100;           // шквал ударов
            // кресло Мёбиуса: по умолчанию 25% шанс, но в меню можно выбрать «всегда» / «никогда»
            this.wSit = chairForce === 'chair' ? 150 : chairForce === 'normal' ? 0 : (Math.random() < 0.25 ? 150 : 0);
            this.wStandFx = 0;         // волна при вставании
            // Роблокс Егор
            this.egSpeed = 14;         // px за кадр, ×2 каждые 0,5 сек
            this.egSpeedT = 0;
            this.egCd1 = 150;          // клонирование
            this.egCd2 = 700;          // создание мультивселенной
            this.egMeme = 300;         // мемность
            this.egCloneKind = 0;
            this.egClones = [];
            this.egMicro = 0;          // микро-клон внутри врага
            this.egMicroT = null;
            this.egAdapt = {};         // типы атак, к которым уже адаптировался
            this.egPhase = '';         // '' | 'verse' | 'true'
            this.egTimer = 0;
            this.egTrueUsed = false;
            this.egBlockTxt = 0;
            // Doubling: каждые 2 сек удваивает себя
            this.dbMul = 1;
            this.dbT = 0;
            this.dbSpeed = 2.2;
            this.dbStrikeCd = 0;
            this.dbAng = 0;
            this.dbFx = 0;
            // Cosmic Alien
            this.cmStacks = 0;
            this.cmAdaptCd = 0;
            this.cmFear = false;
            this.cmInvuln = 0;
            this.cmState = '';
            this.cmT = 0;
            this.cmCdM = 120;       // метеоры
            this.cmCdN = 420;       // сверхновая
            this.cmCdC = 60;        // комбо-телепорт
            this.cmStrikeCd = 0;
            this.cmMeteors = [];
            this.cmBlast = 0;       // кольцо взрыва (кадры)
            this.cmBlastR = 0;
            this.cmFx = 0;
            this.opPhase = 0;       // «Серьёзный удар»: 0 нет, 1 замах, 2 удар
            this.opT = 0; this.opFx = 0; this.opId = 0;
            this.opTx = 0; this.opTy = 0; this.opSx = 0; this.opSy = 0; this.opHx = 0; this.opHy = 0; this.opDmg = 60;
            this.cmCdP = 0; this.cmReactId = 0; this.cmMax = 100;
            this.rbState = ''; this.rbT = 0; this.rbCdC = 120; this.rbCdB = 220; this.rbAng = 0; this.rbHits = 0; this.rbFx = 0;
            this.rbOver = false; this.rbStrikeCd = 0; this.rbRipped = false; this.rbCoreOut = false;
            this.osRage = false;
            this.supreme = false; this.rdT = 0; this.rdTarget = null; this.cnT = 0; this.cnTarget = null;
            this.osRing = []; this.osBurst = 0; this.osGhosts = []; this.osAng = 0; this.osQueue = []; this.osSeries = false; this.osSeriesCd = 360; this.osHopFx = 0;
            this.osMove = ''; this.osT = 0; this.osHits = 0; this.osTx = 0; this.osTy = 0; this.osFxX = 0; this.osFxY = 0;
            this.cmLib = {};        // скопированные приёмы
            this.cmLibN = 0;
            this.cmClock = 0;
            this.cmCdK = 240;       // перезарядка применения копии
            this.cmCopy = null;
            this.cmTarget = null;
            this.cmZap = 0;
            this.cmStars = [];
            for (let i = 0; i < 9; i++) this.cmStars.push({ a: Math.random() * Math.PI * 2, r: Math.random() * 0.8, s: 0.6 + Math.random() * 1.2 });
            // Клон: удваивает своё количество
            this.isCopy = false;
            this.cloneGroup = type === 'cloner' ? this : null;
            this.clT = 0;
            this.clFx = 0;
            this.clStrikeCd = 0;
            this.clAng = Math.random() * Math.PI * 2;
            this.egRegenFx = 0; this.egRegenTxt = 0;
            this.egMul = this.wSit > 0 ? 1000 : 1;   // кресло Мёбиуса: все способности Егора (актив и пассив) ×1000
            if (this.type === 'egor' && this.egMul > 1) this.hp = 100 * this.egMul;
            this.wChair = this.wSit > 0;   // бафф кресла: лечение на 250% быстрее до конца раунда

            // Чёрный Флэш — охотник из Силы Скорости
            this.bfCooldown = 90;
            this.bfSpeed = BF_BASE;    // растёт ×3 каждые 2 сек
            this.bfSpeedT = 0;
            this.bfMissed = false;     // цель уже уклонилась в этом рывке
            this.bfPhase = '';
            this.bfTimer = 0;
            this.bfTarget = null;
            this.bfAngle = 0;
            this.bfTrail = [];

            // общее
            this.out = false;          // выбыл из боя
            this.disorientTimer = 0;   // дезориентация (голограммы Prism)
            this.kbx = 0;              // отбрасывание
            this.kby = 0;
            this.kbTimer = 0;

            // накопление периодического урона
            this.dotAcc = 0;
            this.dotTimer = 0;

            // стартовое HP
            if (type === 'muha2') {
                this.hp = 10;
            } else if (type === 'mahoraga') {
                this.hp = 200;
                this.radius = 26;
            }

            this.randomizeVelocity();
        }

        randomizeVelocity() {
            const a = Math.random() * Math.PI * 2;
            const s = 2 + Math.random() * 1.2;
            this.dx = Math.cos(a) * s;
            this.dy = Math.sin(a) * s;
        }

        // Автор неуязвим, пока заряжает «стереть»
        // уровень игрока: The First Blue Guy и Supreme Author — неуязвимы и неподвластны негативным эффектам
        isGodTier() { return this.type === 'thefirstblueguy' || this.type === 'muha1' || (this.type === 'author' && this.supreme); }

        isUntouchable() {
            return this.isGodTier() || ((this.type === 'wally' || this.type === 'egor') && this.wSit > 0) ||
                (this.type === 'cosmic' && this.cmInvuln > 0) ||
                (this.type === 'egor' && this.egPhase === 'true') || (this.type === 'author' && this.skill === 'erase' && this.skillPhase === 'charge');
        }

        // Муха 2: почти абсолютное уклонение; Годжо: Бесконечность
        tryDodge(amount) {
            if (this.type === 'muha2') {
                if (Math.random() < 0.9999999) {
                    floatingTexts.push(new FloatingText(this.x, this.y - 18, 'DODGE!', '105, 240, 174'));
                    return true;
                }
            }
            if (this.type === 'wally') {
                // Сила скорости: 75% шанс просто не оказаться там, куда бьют
                if (Math.random() < 0.75) {
                    floatingTexts.push(new FloatingText(this.x, this.y - 18, 'DODGED!', '129, 212, 250'));
                    this.afterimages.push({ x: this.x, y: this.y, life: 14 });
                    return true;
                }
            }
            if (this.type === 'naoya') {
                // Проекция: иногда успевает уйти «между кадрами»
                if (Math.random() < 0.2) {
                    floatingTexts.push(new FloatingText(this.x, this.y - 18, 'BETWEEN FRAMES', '255, 224, 130'));
                    this.afterimages.push({ x: this.x, y: this.y, life: 14 });
                    return true;
                }
            }
            if (this.type === 'gojo') {
                // Бесконечность Годжо — очень высокий шанс не получить урон
                if (Math.random() < 0.92) {
                    floatingTexts.push(new FloatingText(this.x, this.y - 18, 'INFINITY', '144, 202, 249'));
                    return true;
                }
            }
            return false;
        }

        // Регистрация попадания приёмом по Махораге (адаптация после 3 раз)
        registerAdaptHit(atkType) {
            if (this.type !== 'mahoraga' || !atkType) return false;
            if (this.adaptedTo[atkType]) return true; // уже адаптирован — полный иммунитет
            this.adaptHits[atkType] = (this.adaptHits[atkType] || 0) + 1;
            if (this.adaptHits[atkType] >= 3) {
                this.adaptedTo[atkType] = true;
                this.adaptation = Math.min(7, this.adaptation + 1);
                const labels = {
                    laser: 'LASER', purple: 'PURPLE', domain_gojo: 'GOJO DOMAIN',
                    domain_sukuna: 'SUKUNA DOMAIN', cleave: 'DISMANTLE', snap: 'SNAP',
                    oneshot: 'ONE SHOT', contact: 'HIT', aura: 'AURA', prism: 'PRISM',
                    shadow: 'SHADOW', naoya: 'PROJECTION', time: 'TIME', wally: 'STRIKES', infmass: 'INF. MASS', rage: 'RAGE', anti: 'ANTI', erase: 'ERASE', other: 'MOVE'
                };
                floatingTexts.push(new FloatingText(this.x, this.y - 36,
                    'ADAPTATION: ' + (labels[atkType] || atkType) + '!', '255, 235, 59'));
                playTimeStopSound();
                return true;
            }
            return false;
        }

        applyHp(amount, atkType) {
            // One Shot бессмертен: урон по нему не проходит
            if (this.type === 'oneshot' || this.isUntouchable()) return;
            if (this.tryDodge(amount)) return;
            // Махорага: иммунитет к адаптированным приёмам
            if (this.type === 'mahoraga' && atkType && this.adaptedTo[atkType]) {
                floatingTexts.push(new FloatingText(this.x, this.y - 18, 'IMMUNE', '255, 235, 59'));
                return;
            }
            if (this.type === 'mahoraga' && atkType) this.registerAdaptHit(atkType);
            // Общая адаптация снижает урон
            if (this.type === 'mahoraga' && this.adaptation > 0) {
                amount *= Math.max(0.15, 1 - this.adaptation * 0.12);
            }
            // Cosmic Alien: адаптация режет урон
            if (this.type === 'cosmic') {
                amount *= 1 - this.cmReduce();
                this.cmOnHit();
            }
            // Муха 2: каждый успешный удар снимает 1 жизнь
            if (this.type === 'muha2') {
                this.hp -= 1;
            } else {
                this.hp -= amount;
            }
            if (this.type === 'cosmic') this.cmCheckFear();
        }

        takeDamage(amount, atkType) {
            if (this.isFakeDead || this.type === 'oneshot' || this.isUntouchable()) return;
            if (this.type === 'goku' && this.gokuDodge()) return;
            if (this.gbRevive(amount)) return;
            // Ультра Эго: получая урон, Вегета становится сильнее (стаки), сам урон по нему на 25% меньше
            if (this.type === 'vegeta' && this.vgForm === 2 && amount > 0) {
                this.vgStacks = Math.min(30, this.vgStacks + 1);
                amount *= 0.75;
            }
            // бой One Shot против Гоку: удары One Shot тоже усилены в 150 000 раз (+15 000 000%)
            if (this.type === 'goku' && this.gkPow && typeof atkType === 'string' && atkType.indexOf('oneshot') === 0) amount *= GK_POW;
            if (this.type === 'egor' && this.egorBlocks(amount, atkType)) return;
            if (this.type === 'timegod' && atkType !== 'infmass' && this.hp - amount <= 0 && this.timeGodRewind(50)) return;
            atkType = atkType || 'other';
            if (this.type === 'cosmic' && atkType === 'oneshot' && amount < 5000 && Math.random() < 0.3) {
                // уклонение от удара за спину
                const sa = Math.random() * Math.PI * 2;
                this.x += Math.cos(sa) * 45; this.y += Math.sin(sa) * 45;
                this.cmFx = 20;
                floatingTexts.push(new FloatingText(this.x, this.y - 30, 'DODGED THE BACKSTAB!', '224, 187, 255'));
                playChargeSound(0.3);
                return;
            }
            if (this.type === 'cosmic') this.cmLearn(amount, atkType, 'hit');
            // Юта копирует приём, которым по нему попали
            if (this.type === 'yuta' && atkType && atkType !== 'other' && atkType !== 'contact' && atkType !== 'yuta_beam') {
                if (!this.seenSkills[atkType]) {
                    this.seenSkills[atkType] = true;
                    this.copiedSkill = atkType;
                    this.copyUses = 3;
                    floatingTexts.push(new FloatingText(this.x, this.y - 40, 'COPIED: ' + atkType, '144, 164, 255'));
                } else if (!this.copiedSkill || this.copyUses <= 0) {
                    this.copiedSkill = atkType;
                    this.copyUses = 2;
                }
            }
            const before = this.hp;
            this.applyHp(amount, atkType);
            if (this.hp < before) {
                if (this.type === 'muha2') {
                    floatingTexts.push(new FloatingText(this.x, this.y, '-1 life'));
                } else {
                    floatingTexts.push(new FloatingText(this.x, this.y, '-' + (Math.round(amount * 10) / 10) + ' HP'));
                }
            }
        }

        // постоянный урон: числа показываем раз в 20 кадров
        // Простой домен: барьер принимает на себя урон чужого домена и разъедается им
        simpleAbsorb(amount, atkType) {
            if (!this.simpleActive) return false;
            if (atkType !== 'domain_gojo' && atkType !== 'domain_sukuna') return false;
            this.simpleHp -= amount * (atkType === 'domain_gojo' ? SIMPLE_ERODE_GOJO : SIMPLE_ERODE_SUKUNA);
            return true;
        }

        dot(amount, atkType) {
            if (this.isFakeDead || this.type === 'oneshot' || this.isUntouchable()) return;
            if (this.type === 'egor' && this.egorBlocks(amount, atkType)) return;
            atkType = atkType || 'other';
            if (this.gbRevive(amount)) return;
            if (this.simpleAbsorb(amount, atkType)) return;
            if (this.type === 'cosmic') this.cmLearn(amount, atkType, 'dot');
            // Юта учит приём с DoT (лазер/гранит и т.п.)
            if (this.type === 'yuta' && atkType && atkType !== 'other' && atkType !== 'contact' && atkType !== 'yuta_beam') {
                if (!this.seenSkills[atkType]) {
                    this.seenSkills[atkType] = true;
                    this.copiedSkill = atkType;
                    this.copyUses = 3;
                    floatingTexts.push(new FloatingText(this.x, this.y - 40, 'COPIED: ' + atkType, '144, 164, 255'));
                }
            }
            const before = this.hp;
            if (this.type === 'mahoraga' && atkType && this.adaptedTo[atkType]) {
                if (Math.random() < 0.05) {
                    floatingTexts.push(new FloatingText(this.x, this.y - 18, 'IMMUNE', '255, 235, 59'));
                }
                return;
            }
            this.applyHp(amount, null);
            if (this.type === 'mahoraga' && atkType) {
                this.dotAdaptAcc = (this.dotAdaptAcc || 0) + 1;
                if (this.dotAdaptAcc >= 20) {
                    this.dotAdaptAcc = 0;
                    this.registerAdaptHit(atkType);
                }
            }
            if (this.hp < before) {
                this.dotAcc += amount;
                this.dotTimer++;
                if (this.dotTimer >= 20) {
                    floatingTexts.push(new FloatingText(this.x, this.y, '-' + this.dotAcc.toFixed(1) + ' HP'));
                    this.dotAcc = 0;
                    this.dotTimer = 0;
                }
            }
        }

        // Гарантированное попадание (домен Сукуны) — игнорирует уклонение и Бесконечность
        sureHit(amount, atkType) {
            if (this.isFakeDead || this.type === 'oneshot' || this.isUntouchable()) return;
            if (this.type === 'egor' && this.egorBlocks(amount, atkType)) return;
            if (this.type === 'timegod' && atkType !== 'infmass' && this.hp - amount <= 0 && this.timeGodRewind(50)) return;
            atkType = atkType || 'domain_sukuna';
            if (this.gbRevive(amount)) return;
            if (this.type === 'cosmic') this.cmLearn(amount, atkType, 'sure');
            if (this.simpleAbsorb(amount, atkType)) return;
            if (this.type === 'mahoraga' && this.adaptedTo[atkType]) {
                if (Math.random() < 0.08) {
                    floatingTexts.push(new FloatingText(this.x, this.y - 18, 'IMMUNE', '255, 235, 59'));
                }
                return;
            }
            // счётчик адаптации для sure-hit DoT
            if (this.type === 'mahoraga') {
                this.dotAdaptAcc = (this.dotAdaptAcc || 0) + 1;
                if (this.dotAdaptAcc >= 18) {
                    this.dotAdaptAcc = 0;
                    this.registerAdaptHit(atkType);
                }
                if (this.adaptation > 0) {
                    amount *= Math.max(0.25, 1 - this.adaptation * 0.08);
                }
            }
            if (this.type === 'cosmic') {
                amount *= 1 - this.cmReduce();
                this.cmOnHit();
            }
            if (this.type === 'muha2') {
                // огромный урон (×1000 у Егора, коллапс) отнимает все жизни сразу
                this.hp -= amount >= 1000 ? this.hp : 1;
                floatingTexts.push(new FloatingText(this.x, this.y, amount >= 1000 ? 'ALL LIVES' : '-1 life'));
            } else {
                this.hp -= amount;
                if (this.type === 'cosmic') this.cmCheckFear();
                this.dotAcc += amount;
                this.dotTimer++;
                if (this.dotTimer >= 15) {
                    floatingTexts.push(new FloatingText(this.x, this.y, '-' + this.dotAcc.toFixed(1) + ' HP'));
                    this.dotAcc = 0;
                    this.dotTimer = 0;
                }
            }
        }

        heal(amount) {
            if (this.type === 'muha2') {
                this.hp = Math.min(10, this.hp + amount);
            } else if (this.type === 'mahoraga') {
                this.hp = Math.min(200, this.hp + amount);
            } else if (this.isMeguna) {
                this.hp = Math.min(150, this.hp + amount);
            } else if (this.type === 'author' && this.supreme) {
                this.hp = Math.min(300, this.hp + amount);
            } else if (this.type === 'cosmic') {
                this.hp = Math.min(this.cmMax, this.hp + amount);
            } else if (this.type === 'cloner') {
                this.hp = Math.min(this.isCopy ? CLONER_HP : 100, this.hp + amount);
            } else if (this.type === 'doubling') {
                this.hp = Math.min(100 * this.dbMul, this.hp + amount);
            } else if (this.type === 'egor') {
                this.hp = Math.min((this.egTrueUsed ? 10000 : 100) * this.egMul, this.hp + amount);
            } else {
                this.hp = Math.min(100, this.hp + amount);
            }
        }

        startFakeDeath() {
            if (this.isGodTier()) return;
            this.isFakeDead = true;
            this.fakeDeathTimer = 150;
            this.hp = 0;
            this.cancelAuthorSkill();
            this.dx = 0;
            this.dy = 0;
            if (timeStopOwner === this) timeStopOwner = null;
            floatingTexts.push(new FloatingText(this.x, this.y - 30, 'FELL...?', '200, 200, 200'));
        }

        erase() {
            if (this.isGodTier() || this.erased) return;
            this.erased = true;
            this.eraseTimer = 45;
            this.sealed = true;
            this.hp = 0;
            this.dx = 0;
            this.dy = 0;
            if (timeStopOwner === this) timeStopOwner = null;
            playExplosionSound();
        }

        endSkill() {
            this.skill = null;
            this.skillPhase = '';
            this.skillTimer = 0;
            this.isAuthorCharging = false;
            this.authorChargeTimer = 0;
            this.authorCooldown = 0;
            this.strikeTimer = 0;
            this.randomizeVelocity();
        }

        cancelAuthorSkill() {
            this.isRaging = false;
            this.rageTimer = 0;
            this.comboHitsLeft = 0;
            this.antiActive = false;
            this.antiTimer = 0;
            this.endSkill();
        }

        // телепорт за спину врага: «спина» — сторона, противоположная его движению
        teleportBehind(enemy) {
            let vx = enemy.dx, vy = enemy.dy;
            if (enemy.stunTimer > 0 || Math.hypot(vx, vy) < 0.3) {
                vx = this.x - enemy.x;
                vy = this.y - enemy.y;
            }
            const len = Math.hypot(vx, vy) || 1;
            const gap = this.radius + enemy.radius + 2;
            this.ghostX = this.x;
            this.ghostY = this.y;
            this.ghostTimer = 25;
            this.x = Math.max(this.radius, Math.min(W - this.radius, enemy.x - vx / len * gap));
            this.y = Math.max(this.radius, Math.min(H - this.radius, enemy.y - vy / len * gap));
            this.strikeTimer = this.osRage ? 6 : 15;
            playLaserSound();
            floatingTexts.push(new FloatingText(this.x, this.y - 30, 'BEHIND YOU!', '255, 80, 80'));
        }

        // ярость SCP-096 (общая для SCP-096 и Автора)
        rageStep(enemy, dist) {
            if (this.comboHitsLeft > 0) {
                this.dx = 0;
                this.dy = 0;
                if (enemy) enemy.stunTimer = Math.max(enemy.stunTimer, 3);
                this.comboDelay--;
                if (this.comboDelay <= 0) {
                    if (enemy) enemy.takeDamage(7);
                    playHitSound();
                    this.comboHitsLeft--;
                    this.comboDelay = 12;
                    if (this.comboHitsLeft <= 0) {
                        this.isRaging = false;
                        this.rageTimer = 0;
                        this.rageCooldown = 0;
                        if (enemy) enemy.stunTimer = 0;
                        this.randomizeVelocity();
                    }
                }
            } else {
                this.rageTimer++;
                if (enemy) {
                    const angle = Math.atan2(enemy.y - this.y, enemy.x - this.x);
                    this.dx = Math.cos(angle) * 4.2;
                    this.dy = Math.sin(angle) * 4.2;
                }
                this.x += this.dx;
                this.y += this.dy;
                if (enemy && !enemy.isFakeDead && !enemy.erased && dist <= this.radius + enemy.radius + 2) {
                    this.comboHitsLeft = 5;
                    this.comboDelay = 0;
                    enemy.stunTimer = 70;
                } else if (this.rageTimer >= 300) {
                    this.isRaging = false;
                    this.rageTimer = 0;
                    this.rageCooldown = 0;
                    this.randomizeVelocity();
                }
            }
        }

        // поле Анти-Шара (общее для Анти-Шара и поля Автора)
        applyAntiField(enemy, dist) {
            if (enemy.type === 'blue' || enemy.type === 'red') {
                if (dist <= (enemy.isUlt ? 260 : 150)) {
                    if (enemy.isUsingAbility || enemy.isCharging) {
                        enemy.isUsingAbility = false;
                        enemy.isUlt = false;
                        enemy.isCharging = false;
                        enemy.chargeTimer = 0;
                        enemy.abilityTimer = 0;
                        enemy.cooldownTimer = 0;
                        if (enemy.dx === 0 && enemy.dy === 0) enemy.randomizeVelocity();
                    }
                    enemy.dot(0.3);
                    this.heal(0.3);
                }
            } else if (enemy.type === 'prism') {
                // у Prism большая дальность — поле Анти-Шара накрывает его издалека
                if (dist <= 260) {
                    if (enemy.beamOn || enemy.focusPhase) enemy.resetPrism();
                    enemy.dot(0.3);
                    this.heal(0.3);
                }
            } else if (enemy.type === 'timegod') {
                // Анти-Шар не подчиняется времени: остановка и поле ломаются
                if (dist <= 130) {
                    if (enemy.tgPhase || enemy.zoneT > 0) {
                        enemy.resetTimeGod();
                        enemy.stunTimer = Math.max(enemy.stunTimer, 60);
                        floatingTexts.push(new FloatingText(enemy.x, enemy.y - 30, 'TIME BROKEN!', '206, 147, 216'));
                    }
                    enemy.dot(0.3);
                    this.heal(0.3);
                }
            } else if (enemy.type === 'wally') {
                // Анти-Шар гасит Силу скорости: способности сорваны, разгон сброшен
                if (dist <= 130) {
                    if (enemy.wPhase) {
                        enemy.resetWally();
                        floatingTexts.push(new FloatingText(enemy.x, enemy.y - 30, 'SPEED FORCE DRAINED!', '206, 147, 216'));
                    }
                    enemy.wSpeed = WALLY_BASE;
                    enemy.wSpeedT = 0;
                    enemy.dot(0.3);
                    this.heal(0.3);
                }
            } else if (enemy.type === 'naoya') {
                // поле Анти-Шара ломает «кадры»: рывок и серия срываются
                if (dist <= 130) {
                    if (enemy.naoyaPhase) {
                        enemy.resetNaoya();
                        enemy.stunTimer = Math.max(enemy.stunTimer, 60);
                        floatingTexts.push(new FloatingText(enemy.x, enemy.y - 30, 'PROJECTION BROKEN!', '206, 147, 216'));
                    }
                    enemy.dot(0.3);
                    this.heal(0.3);
                }
            } else if (enemy.type === 'green') {
                if (enemy.healTimer >= 358) {
                    enemy.takeDamage(15);
                    this.heal(15);
                    floatingTexts.push(new FloatingText(this.x, this.y, '+15 HP', '206, 147, 216'));
                    enemy.healTimer = 0;
                }
            } else if (enemy.type === 'oneshot') {
                if (enemy.isOneShotCharging && dist <= 90) {
                    enemy.isOneShotCharging = false;
                    enemy.oneShotChargeTimer = 0;
                    enemy.oneShotCooldown = 0;
                    enemy.stunTimer = 90;
                }
            } else if (enemy.type === 'scp096') {
                if (enemy.isRaging && dist <= 80) {
                    enemy.isRaging = false;
                    enemy.rageTimer = 0;
                    enemy.rageCooldown = 0;
                    enemy.comboHitsLeft = 0;
                    enemy.stunTimer = 120;
                }
            }
        }

        // у Анти-Шара свой ответ на каждую способность Автора
        counterAuthor(enemy, dist) {
            const say = function (t) {
                floatingTexts.push(new FloatingText(enemy.x, enemy.y - 30, t, '206, 147, 216'));
            };

            // пассивка «Зелёного»: кража лечения
            if (enemy.healTimer >= 358) {
                enemy.takeDamage(15);
                this.heal(15);
                floatingTexts.push(new FloatingText(this.x, this.y, '+15 HP', '206, 147, 216'));
                enemy.healTimer = 0;
            }
            // остановка времени: Анти-Шар её ломает
            if (timeStopOwner === enemy) {
                timeStopOwner = null;
                enemy.cancelAuthorSkill();
                enemy.stunTimer = 90;
                say('TIME BROKEN!');
                return;
            }
            // лазер: отражается обратно в Автора
            if (enemy.skill === 'laser' && enemy.skillPhase === 'active' && dist <= 150) {
                enemy.takeDamage(10);
                enemy.cancelAuthorSkill();
                enemy.stunTimer = 60;
                say('REFLECTED!');
                return;
            }
            // анти-поле Автора: подавляется
            if (enemy.skill === 'antifield' && enemy.skillPhase === 'active') {
                enemy.cancelAuthorSkill();
                enemy.stunTimer = 60;
                say('FIELD SUPPRESSED!');
                return;
            }
            // ярость: гасится вблизи
            if (enemy.isRaging && dist <= 80) {
                enemy.cancelAuthorSkill();
                enemy.stunTimer = 120;
                say('RAGE SUPPRESSED!');
                return;
            }
            // любой заряд (в т.ч. «стереть» и «за спину») срывается вблизи
            if (enemy.isAuthorCharging && dist <= 90) {
                enemy.cancelAuthorSkill();
                enemy.stunTimer = 90;
                say('CHARGE DISRUPTED!');
                return;
            }
            // «за спину»: парирование удара — в updateAuthor
            // «стереть»: отражение на самого Автора — в beginSkill
            // возрождение: печать на «трупе» — в update Анти-Шара
        }

        pickAuthorSkill() {
            const list = ['laser', 'timestop', 'teleport', 'rage', 'antifield'];
            if (this.supreme) list.push('redact', 'contain', 'redact', 'contain');
            if (this.eraseReadyTimer >= (this.supreme ? 450 : 900)) list.push('erase', 'erase', 'erase');
            this.skill = list[Math.floor(Math.random() * list.length)];
            this.skillPhase = 'charge';
            this.skillTimer = 0;
            this.authorChargeTimer = 0;
            this.isAuthorCharging = true;
            this.authorChargeMax = { laser: 70, timestop: 90, teleport: 90, rage: 30, antifield: 40, erase: 150, redact: 50, contain: 60 }[this.skill];
            if (this.supreme) this.authorChargeMax = Math.round(this.authorChargeMax * 0.7);
            const labels = { laser: 'LASER', timestop: 'TIME STOP', teleport: 'BACKSTAB', rage: 'RAGE', antifield: 'ANTI-FIELD', erase: 'ERASE', redact: '[REDACTED]', contain: 'CONTAINMENT' };
            floatingTexts.push(new FloatingText(this.x, this.y - 32, labels[this.skill],
                this.skill === 'erase' ? '255, 255, 255' : '255, 234, 0'));
        }

        beginSkill(enemy) {
            this.skillPhase = 'active';
            this.skillTimer = 0;
            const targetOk = enemy && !enemy.isFakeDead && !enemy.erased;
            switch (this.skill) {
                case 'laser':
                    playLaserSound();
                    break;
                case 'timestop':
                    startTimeStop(this);
                    break;
                case 'teleport':
                    if (targetOk) this.teleportBehind(enemy);
                    else this.endSkill();
                    break;
                case 'rage':
                    this.isRaging = true;
                    this.rageTimer = 0;
                    this.comboHitsLeft = 0;
                    playCoughSound();
                    floatingTexts.push(new FloatingText(this.x, this.y - 30, 'RAGE!', '255, 60, 60'));
                    break;
                case 'antifield':
                    this.antiActive = true;
                    this.antiTimer = 0;
                    break;
                case 'redact':
                    // [REDACTED]: цензура накрывает врага — удар, срыв способностей, оглушение
                    if (!targetOk) { this.endSkill(); break; }
                    this.rdTarget = enemy;
                    this.rdT = 110;
                    enemy.cancelAuthorSkill();
                    enemy.stunTimer = Math.max(enemy.stunTimer, 110);
                    enemy.takeDamage(20, 'redact');
                    floatingTexts.push(new FloatingText(enemy.x, enemy.y - 30, '[REDACTED]', '255, 255, 255'));
                    playExplosionSound();
                    this.endSkill();
                    break;
                case 'contain':
                    // Содержание: клетка вокруг врага
                    if (!targetOk) { this.endSkill(); break; }
                    this.cnTarget = enemy;
                    this.cnT = 160;
                    floatingTexts.push(new FloatingText(enemy.x, enemy.y - 30, 'CONTAINED', '255, 213, 79'));
                    playChargeSound(0.6);
                    this.endSkill();
                    break;
                case 'erase':
                    if (!targetOk) {
                        this.endSkill();
                        break;
                    }
                    if (enemy.type === 'antiball' && enemy.antiActive) {
                        // Анти-Шар в активной фазе отражает стирание
                        floatingTexts.push(new FloatingText(this.x, this.y - 30, 'REFLECTED!', '206, 147, 216'));
                        this.erase();
                    } else {
                        floatingTexts.push(new FloatingText(enemy.x, enemy.y - 30, 'ERASED!', '255, 255, 255'));
                        enemy.erase();
                    }
                    this.eraseReadyTimer = 0;
                    this.endSkill();
                    break;
                default:
                    this.endSkill();
            }
        }

        updateAuthor(enemy, dist) {
            if (this.ghostTimer > 0) this.ghostTimer--;

            // пассивки «Зелёного»: лечение и аура урона
            this.healTimer++;
            if (this.healTimer >= 360) {
                this.heal(10);
                floatingTexts.push(new FloatingText(this.x, this.y, '+10 HP', '120, 255, 120'));
                this.healTimer = 0;
            }
            this.damageAuraTimer++;
            if (this.damageAuraTimer >= 390) {
                if (enemy && !enemy.isFakeDead && !enemy.erased && dist <= 50) enemy.takeDamage(3.5);
                this.damageAuraTimer = 0;
            }
            this.eraseReadyTimer++;
            if (this.rdT > 0) { this.rdT--; if (this.rdT <= 0) this.rdTarget = null; }
            if (this.cnT > 0) {
                this.cnT--;
                const ct = this.cnTarget;
                if (ct && !ct.out && !ct.isFakeDead && !ct.erased) {
                    ct.stunTimer = Math.max(ct.stunTimer, 3);
                    ct.dot(0.22);
                } else {
                    this.cnT = 0;
                }
                if (this.cnT <= 0) this.cnTarget = null;
            }

            // остановка времени
            if (timeStopOwner === this) {
                if (this.hitDelay > 0) this.hitDelay--;
                const stopTargetOk = enemy && !enemy.isFakeDead && !enemy.erased;
                if (stopTargetOk && this.stopHitsLeft > 0) {
                    const reach = this.radius + enemy.radius - 2;
                    if (dist > reach) {
                        // быстрый рывок к замершему врагу
                        const angle = Math.atan2(enemy.y - this.y, enemy.x - this.x);
                        const step = Math.min(12, dist - reach);
                        this.x += Math.cos(angle) * step;
                        this.y += Math.sin(angle) * step;
                    } else if (this.hitDelay <= 0) {
                        // 10 ударов по 5 урона
                        enemy.takeDamage(this.supreme ? TIME_STOP_HIT_DAMAGE * 2 : TIME_STOP_HIT_DAMAGE);
                        playHitSound();
                        this.stopHitsLeft--;
                        this.hitDelay = 10;
                    }
                }
                timeStopTimer--;
                if (timeStopTimer <= 0 || !stopTargetOk || (this.stopHitsLeft <= 0 && this.hitDelay <= 0)) {
                    timeStopOwner = null;
                    this.endSkill();
                }
                return;
            }

            // между способностями — катится и ждёт
            if (!this.skill) {
                this.x += this.dx;
                this.y += this.dy;
                this.authorCooldown++;
                if (this.authorCooldown >= (this.supreme ? 110 : 200)) this.pickAuthorSkill();
                return;
            }

            // зарядка способности
            if (this.skillPhase === 'charge') {
                this.dx = 0;
                this.dy = 0;
                if (enemy && this.skill === 'laser') {
                    this.targetAngle = Math.atan2(enemy.y - this.y, enemy.x - this.x);
                }
                this.authorChargeTimer++;
                if (this.authorChargeTimer >= this.authorChargeMax) {
                    this.isAuthorCharging = false;
                    this.authorChargeTimer = 0;
                    this.beginSkill(enemy);
                }
                return;
            }

            // активная фаза
            const targetOk = enemy && !enemy.isFakeDead && !enemy.erased;
            switch (this.skill) {
                case 'laser':
                    this.dx = 0;
                    this.dy = 0;
                    if (enemy) this.targetAngle = Math.atan2(enemy.y - this.y, enemy.x - this.x);
                    this.skillTimer++;
                    if (targetOk && this.laserHits(enemy)) enemy.dot(this.supreme ? 0.34 : 0.17);
                    if (this.skillTimer >= 200) this.endSkill();
                    break;
                case 'teleport':
                    this.dx = 0;
                    this.dy = 0;
                    this.strikeTimer--;
                    if (this.strikeTimer <= 0) {
                        if (targetOk && enemy.type === 'antiball' && enemy.antiActive) {
                            // Анти-Шар парирует удар в спину
                            floatingTexts.push(new FloatingText(this.x, this.y - 30, 'PARRIED!', '206, 147, 216'));
                            this.stunTimer = 120;
                        } else if (targetOk) {
                            enemy.takeDamage(999, 'oneshot');
                            playExplosionSound();
                        }
                        this.endSkill();
                    }
                    break;
                case 'rage':
                    this.rageStep(enemy, dist);
                    if (!this.isRaging) this.endSkill();
                    break;
                case 'antifield':
                    this.dx = 0;
                    this.dy = 0;
                    this.antiTimer++;
                    if (targetOk) this.applyAntiField(enemy, dist);
                    if (this.antiTimer >= 200) {
                        this.antiActive = false;
                        this.antiTimer = 0;
                        this.endSkill();
                    }
                    break;
                default:
                    this.endSkill();
            }
        }

        // ближайший противник (выбывших учитываем в последнюю очередь)
        isAlly(o) {
            if (!o || o === this) return true;
            // В режиме 2v2 бойцы одной команды не атакуют друг друга.
            if (isTeamMode() && this.team !== undefined && o.team !== undefined && this.team === o.team) return true;
            // Робот и One Shot, а также Гоку и Вегета не дерутся друг с другом
            if (isPact(this, o)) return true;
            // копии Клона — одна сторона
            if (this.cloneGroup && this.cloneGroup === o.cloneGroup) return true;
            // Махорага союзник своего хозяина
            if (this.type === 'mahoraga' && this.owner === o) return true;
            if (o.type === 'mahoraga' && o.owner === this) return true;
            // Мегуна союзник с Махорагой, которого призвал Мегуми (если остался)
            if (this.isMeguna && o.type === 'mahoraga') return true;
            if (o.isMeguna && this.type === 'mahoraga') return true;
            return false;
        }

        nearestEnemy() {
            let best = null, bd = Infinity;
            for (let i = 0; i < balls.length; i++) {
                const o = balls[i];
                if (o === this || this.isAlly(o)) continue;
                let d = Math.hypot(o.x - this.x, o.y - this.y);
                // бессмертного One Shot не пытаются убить, пока есть другие цели
                if ((this.type === 'cosmic' || this.type === 'robot') && o.type === 'oneshot' && !o.out) d += 5e5;
                if (o.out) d += 1e9;
                else if (o.isFakeDead || o.erased) d += 1e6;
                if (d < bd) { bd = d; best = o; }
            }
            return best;
        }

        // все живые противники
        targets() {
            const self = this;
            return balls.filter(function (o) {
                return o !== self && !o.out && !o.erased && !o.isFakeDead && !self.isAlly(o);
            });
        }

        /* ---------- Бог времени ---------- */
        resetTimeGod() {
            if (this.tgPhase === 'stop') {
                this.targets().forEach(function (t) { if (t.stunTimer <= 3) t.stunTimer = 0; });
            }
            this.tgPhase = '';
            this.tgTimer = 0;
            this.tgBank = 0;
            this.tgTarget = null;
            this.zoneT = 0;
            if (this.dx === 0 && this.dy === 0) this.randomizeVelocity();
        }

        // Перемотка: возврат на 3 секунды назад (по кулдауну или как спасение от смертельного удара)
        timeGodRewind(minHp) {
            if (this.tgCd3 > 0 || this.hist.length < 4) return false;
            const h = this.hist[0];
            this.hp = Math.max(minHp, Math.min(100, h.hp));
            this.x = h.x;
            this.y = h.y;
            this.tgCd3 = 700;
            this.rewindFx = 45;
            this.hist = [];
            floatingTexts.push(new FloatingText(this.x, this.y - 34, 'REWIND', '255, 224, 130'));
            playTimeStopSound();
            return true;
        }

        updateTimeGod(enemy, dist) {
            const self = this;
            this.clockAng -= 0.06;
            if (this.rewindFx > 0) this.rewindFx--;
            this.tgCd1++;
            this.tgCd2++;
            if (this.tgCd3 > 0) this.tgCd3--;

            // снимок состояния раз в 6 кадров (хватает на 3 секунды назад)
            this.histT++;
            if (this.histT >= 6) {
                this.histT = 0;
                this.hist.push({ x: this.x, y: this.y, hp: this.hp });
                if (this.hist.length > 30) this.hist.shift();
            }

            // Перемотка: при низком HP возвращается в состояние трёхсекундной давности
            if (this.hp < 50 && this.tgCd3 <= 0 && this.hist.length >= 8 && this.hist[0].hp > this.hp + 10) {
                this.timeGodRewind(60);
            }

            // Вязкое время: поле вокруг бога замедляет врагов и «старит» их
            if (this.zoneT > 0) {
                this.zoneT--;
                this.targets().forEach(function (t) {
                    if (Math.hypot(t.x - self.x, t.y - self.y) <= TG_ZONE_R + t.radius) {
                        t.slowT = 3;
                        t.dot(0.18, 'time');
                    }
                });
            }

            // Застывшее время: все враги замирают, бог бьёт одну цель, урон обрушивается разом
            if (this.tgPhase === 'stop') {
                this.tgTimer++;
                this.dx = 0;
                this.dy = 0;
                this.targets().forEach(function (t) { t.stunTimer = Math.max(t.stunTimer, 3); });
                const tg = this.tgTarget;
                if (tg && !tg.out && !tg.erased && !tg.isFakeDead) {
                    const d = Math.hypot(tg.x - this.x, tg.y - this.y), reach = this.radius + tg.radius;
                    if (d > reach) {
                        const a = Math.atan2(tg.y - this.y, tg.x - this.x), step = Math.min(10, d - reach);
                        this.x += Math.cos(a) * step;
                        this.y += Math.sin(a) * step;
                    } else if (this.tgTimer % 8 === 0 && this.tgHits < 10) {
                        this.tgHits++;
                        this.tgBank += 7;
                        playHitSound();
                        floatingTexts.push(new FloatingText(tg.x, tg.y - 22, '+5', '255, 224, 130'));
                    }
                }
                if (this.tgTimer >= 120) {
                    const victim = this.tgTarget, bank = this.tgBank, hits = this.tgHits;
                    this.targets().forEach(function (t) { if (t.stunTimer <= 3) t.stunTimer = 0; });
                    this.tgPhase = '';
                    this.tgTimer = 0;
                    this.tgBank = 0;
                    this.tgHits = 0;
                    this.tgTarget = null;
                    this.tgCd1 = 0;
                    this.randomizeVelocity();
                    floatingTexts.push(new FloatingText(this.x, this.y - 34, 'TIME FLOWS!', '255, 224, 130'));
                    if (victim && !victim.out && !victim.erased && bank > 0) {
                        for (let i = 0; i < hits; i++) victim.sureHit(7, 'time');
                        const a = Math.atan2(victim.y - this.y, victim.x - this.x);
                        victim.kbx = Math.cos(a) * 8;
                        victim.kby = Math.sin(a) * 8;
                        victim.kbTimer = 14;
                        playExplosionSound();
                    }
                }
                return;
            }

            // обычное движение и запуск способностей
            this.x += this.dx;
            this.y += this.dy;
            const valid = enemy && !enemy.out && !enemy.isFakeDead && !enemy.erased;
            if (valid && this.tgCd1 >= 330) {
                this.tgPhase = 'stop';
                this.tgTimer = 0;
                this.tgBank = 0;
                this.tgHits = 0;
                this.tgTarget = enemy;
                floatingTexts.push(new FloatingText(this.x, this.y - 34, 'FROZEN TIME', '255, 224, 130'));
                playTimeStopSound();
            } else if (valid && this.zoneT <= 0 && this.tgCd2 >= 300 && dist < 260) {
                this.zoneT = 260;
                this.tgCd2 = 0;
                floatingTexts.push(new FloatingText(this.x, this.y - 34, 'VISCOUS TIME', '255, 224, 130'));
                playChargeSound(0.5);
            }
        }

        /* ---------- One Shot: «Серия обычных ударов» и «Бросок стола» ---------- */
        osHit(t, dmg, type) {
            if (this.osRage && t.type === 'cosmic') { t.cmFear = true; t.cmInvuln = 0; }
            t.takeDamage(dmg, type);
        }

        osEnd(enemy) {
            this.osMove = '';
            this.osT = 0;
            this.osHits = 0;
            if (this.osSeries && this.osQueue.length) { this.osNext(enemy); return; }
            this.osSeries = false;
            this.osQueue = [];
            this.oneShotCooldown = 0;
            this.randomizeVelocity();
        }

        // Killer Move: Serious Series — следующий приём цепочки
        osNext(enemy) {
            const valid = enemy && !enemy.out && !enemy.isFakeDead && !enemy.erased;
            if (!valid) { this.osSeries = false; this.osQueue = []; this.oneShotCooldown = 0; this.randomizeVelocity(); return; }
            const m = this.osQueue.shift();
            const names = { hops: 'SERIOUS SIDE HOPS', sneeze: 'SERIOUS SNEEZE', punch: 'SERIOUS PUNCH' };
            if (m === 'punch') {
                this.punchStart(enemy);
            } else {
                this.osMove = m;
                this.osT = 0;
                this.osHits = 0;
                floatingTexts.push(new FloatingText(this.x, this.y - 34, names[m], '255, 120, 80'));
                playChargeSound(0.5);
            }
        }

        osMoveStep(enemy) {
            const self = this;
            const valid = enemy && !enemy.out && !enemy.isFakeDead && !enemy.erased;
            this.dx = 0;
            this.dy = 0;
            if (!valid) { this.osEnd(enemy); return; }
            const mul = this.osRage ? 1500 : 1;
            this.osT++;
            if (this.osMove === 'barrage') {
                const dist = Math.hypot(enemy.x - this.x, enemy.y - this.y);
                const gap = dist - (this.radius + enemy.radius);
                if (this.osHits === 0 && gap > 4 && this.osT < 45) {
                    const sp = this.osRage ? 14 : 9;
                    this.x += (enemy.x - this.x) / (dist || 1) * Math.min(sp, gap);
                    this.y += (enemy.y - this.y) / (dist || 1) * Math.min(sp, gap);
                } else if (this.osHits === 0 && gap > 22) {
                    this.osEnd(enemy);
                } else {
                    enemy.stunTimer = Math.max(enemy.stunTimer, 3);
                    if (this.osT % (this.osRage ? 2 : 3) === 0) {
                        this.osHits++;
                        const last = this.osHits >= 12;
                        this.osHit(enemy, (last ? 16 : 7) * mul, 'oneshot_barrage');
                        this.osTx = enemy.x;
                        this.osTy = enemy.y;
                        if (last) {
                            const a = Math.atan2(enemy.y - this.y, enemy.x - this.x);
                            enemy.kbx = Math.cos(a) * 8;
                            enemy.kby = Math.sin(a) * 8;
                            enemy.kbTimer = 14;
                            playExplosionSound();
                        } else {
                            playHitSound();
                        }
                    }
                    if (this.osHits >= 12) this.osEnd(enemy);
                }
            } else if (this.osMove === 'hops') {
                // Serious Side Hops: быстрые прыжки по бокам, каждый — ударная волна
                const every = this.osRage ? 5 : 9;
                if (this.osT % every === 1) {
                    const n = Math.floor(this.osT / every);
                    const a = Math.atan2(enemy.y - this.y, enemy.x - this.x) + (n % 2 ? 1 : -1) * Math.PI / 2;
                    const d = this.radius + enemy.radius + 30;
                    this.osGhosts.push({ x: this.x, y: this.y, life: 14 });
                    this.x = Math.max(this.radius, Math.min(W - this.radius, enemy.x + Math.cos(a) * d));
                    this.y = Math.max(this.radius, Math.min(H - this.radius, enemy.y + Math.sin(a) * d));
                    this.osFxX = this.x;
                    this.osFxY = this.y;
                    this.osHopFx = 12;
                    this.targets().forEach(function (t) {
                        if (Math.hypot(t.x - self.x, t.y - self.y) < 100 + t.radius) {
                            self.osHit(t, 5 * mul, 'oneshot_hops');
                            const b = Math.atan2(t.y - self.y, t.x - self.x);
                            t.kbx = Math.cos(b) * 5;
                            t.kby = Math.sin(b) * 5;
                            t.kbTimer = 8;
                        }
                    });
                    playHitSound();
                }
                if (this.osT >= (this.osRage ? 5 : 9) * 6 + 8) this.osEnd(enemy);
            } else if (this.osMove === 'omni') {
                // Omnidirectional Serious Punch: 8 огромных кулаков окружают врага и бьют одновременно со всех сторон
                const wu = this.osRage ? 18 : 44, st = this.osRage ? 6 : 12;
                if (this.osT === 1) { this.osAng = Math.random() * Math.PI * 2; this.osTx = enemy.x; this.osTy = enemy.y; }
                if (this.osT < wu - 10) { this.osTx = enemy.x; this.osTy = enemy.y; }
                if (this.osT === wu + st) {
                    const cx = this.osTx, cy = this.osTy;
                    this.osFxX = cx;
                    this.osFxY = cy;
                    this.osBurst = 22;
                    this.targets().forEach(function (t) {
                        if (Math.hypot(t.x - cx, t.y - cy) < 80 + t.radius) {
                            self.osHit(t, 60 * mul, 'oneshot_omni');
                            const ba = Math.hypot(t.x - cx, t.y - cy) < 2 ? Math.random() * Math.PI * 2 : Math.atan2(t.y - cy, t.x - cx);
                            t.kbx = Math.cos(ba) * 10;
                            t.kby = Math.sin(ba) * 10;
                            t.kbTimer = 14;
                            t.stunTimer = Math.max(t.stunTimer, 30);
                        }
                    });
                    playExplosionSound();
                }
                if (this.osT >= wu + st + 24) this.osEnd(enemy);
            } else if (this.osMove === 'sneeze') {
                // Serious Sneeze: вдох и мощная волна ветра конусом
                const wu = this.osRage ? 10 : 24;
                if (this.osT < wu - 4) this.osAng = Math.atan2(enemy.y - this.y, enemy.x - this.x);
                if (this.osT === wu) {
                    const ang = this.osAng;
                    this.targets().forEach(function (t) {
                        const rx = t.x - self.x, ry = t.y - self.y;
                        let da = Math.atan2(ry, rx) - ang;
                        da = Math.atan2(Math.sin(da), Math.cos(da));
                        if (Math.hypot(rx, ry) < 320 && Math.abs(da) < 0.6) {
                            self.osHit(t, 25 * mul, 'oneshot_sneeze');
                            t.kbx = Math.cos(ang) * 12;
                            t.kby = Math.sin(ang) * 12;
                            t.kbTimer = 18;
                            t.stunTimer = Math.max(t.stunTimer, 30);
                        }
                    });
                    playExplosionSound();
                }
                if (this.osT >= wu + 20) this.osEnd(enemy);
            }
        }

        drawOsMove() {
            // послеобразы прыжков и кольцо волны
            this.osGhosts.forEach(function (g) {
                ctx.beginPath();
                ctx.arc(g.x, g.y, 20, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(255, 60, 60, ' + (g.life / 14 * 0.45) + ')';
                ctx.fill();
            });
            if (this.osHopFx > 0) {
                const k = this.osHopFx / 12;
                ctx.beginPath();
                ctx.arc(this.osFxX, this.osFxY, 20 + (1 - k) * 90, 0, Math.PI * 2);
                ctx.strokeStyle = 'rgba(255, 220, 160, ' + k + ')';
                ctx.lineWidth = 5 * k + 1;
                ctx.stroke();
            }
            if (this.osMove === 'sneeze') {
                const wu = this.osRage ? 10 : 24;
                if (this.osT < wu) {
                    const k = this.osT / wu;
                    ctx.beginPath();
                    ctx.arc(this.x, this.y, this.radius + 34 * (1 - k), 0, Math.PI * 2);
                    ctx.strokeStyle = 'rgba(200, 230, 255, ' + (0.3 + 0.6 * k) + ')';
                    ctx.lineWidth = 3;
                    ctx.stroke();
                } else {
                    const k = (this.osT - wu) / 20;
                    ctx.save();
                    ctx.translate(this.x, this.y);
                    ctx.rotate(this.osAng);
                    const g = ctx.createLinearGradient(0, 0, 320, 0);
                    g.addColorStop(0, 'rgba(220, 240, 255, ' + (0.7 * (1 - k)) + ')');
                    g.addColorStop(1, 'rgba(220, 240, 255, 0)');
                    ctx.beginPath();
                    ctx.moveTo(0, 0);
                    ctx.arc(0, 0, 320, -0.6, 0.6);
                    ctx.closePath();
                    ctx.fillStyle = g;
                    ctx.fill();
                    ctx.strokeStyle = 'rgba(255, 255, 255, ' + (0.8 * (1 - k)) + ')';
                    ctx.lineWidth = 2;
                    for (let i = -3; i <= 3; i++) {
                        const o = (k * 320 + i * 40 + 320) % 320;
                        ctx.beginPath();
                        ctx.moveTo(o, i * 22);
                        ctx.lineTo(o + 50, i * 22);
                        ctx.stroke();
                    }
                    ctx.restore();
                }
            }
            if (this.osMove === 'omni') {
                const wu = this.osRage ? 18 : 44, st = this.osRage ? 6 : 12;
                if (this.osT < wu + st + 2) {
                    const tx = this.osTx, ty = this.osTy;
                    const k = Math.min(1, this.osT / wu);
                    let R, fr;
                    if (this.osT < wu) {
                        R = 120;
                        fr = 8 + 18 * k;
                        ctx.beginPath();
                        ctx.arc(tx, ty, 120, 0, Math.PI * 2);
                        ctx.setLineDash([6, 6]);
                        ctx.strokeStyle = 'rgba(255, 60, 60, ' + (0.15 + 0.5 * k) + ')';
                        ctx.lineWidth = 2;
                        ctx.stroke();
                        ctx.setLineDash([]);
                        ctx.beginPath();
                        ctx.arc(tx, ty, 80, 0, Math.PI * 2);
                        ctx.strokeStyle = 'rgba(255, 255, 255, ' + (0.1 + 0.3 * k) + ')';
                        ctx.stroke();
                    } else {
                        const c = Math.min(1, (this.osT - wu) / st);
                        R = 120 * (1 - c * c);
                        fr = 26;
                    }
                    for (let i = 0; i < 8; i++) {
                        const a = this.osAng + i * Math.PI / 4;
                        const fx = tx + Math.cos(a) * R, fy = ty + Math.sin(a) * R;
                        ctx.beginPath();
                        ctx.arc(fx, fy, fr * 1.5, 0, Math.PI * 2);
                        ctx.fillStyle = 'rgba(255, 51, 51, ' + (0.1 + 0.15 * k) + ')';
                        ctx.fill();
                        this.drawFistShape(fx, fy, fr, a + Math.PI, '#151515', '#ff3333');
                    }
                }
            }
            if (this.osBurst > 0) {
                const k = 1 - this.osBurst / 22;
                ctx.beginPath();
                ctx.arc(this.osFxX, this.osFxY, 16 + k * 140, 0, Math.PI * 2);
                ctx.strokeStyle = 'rgba(255, 110, 110, ' + (1 - k) + ')';
                ctx.lineWidth = 8 * (1 - k) + 2;
                ctx.stroke();
                ctx.beginPath();
                ctx.arc(this.osFxX, this.osFxY, 50 * (1 - k), 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(255, 255, 255, ' + (0.8 * (1 - k)) + ')';
                ctx.fill();
            }
            if (this.osMove === 'barrage' && this.osHits > 0) {
                for (let i = 0; i < 4; i++) {
                    const a = Math.random() * Math.PI * 2, d = 8 + Math.random() * 34;
                    this.drawFistShape(this.osTx + Math.cos(a) * d, this.osTy + Math.sin(a) * d, 11, a + Math.PI, '#151515', '#ff3333');
                }
                ctx.beginPath();
                ctx.arc(this.osTx, this.osTy, 22 + Math.random() * 10, 0, Math.PI * 2);
                ctx.strokeStyle = 'rgba(255, 80, 80, 0.7)';
                ctx.lineWidth = 3;
                ctx.stroke();
            }
        }

        /* ---------- Робот-киборг ---------- */
        updateRobot(enemy, dist) {
            const self = this;
            const mul = this.rbOver ? 1.3 : 1;
            this.wSpin += this.rbOver ? 0.12 : 0.05;
            if (this.rbFx > 0) this.rbFx--;
            if (this.rbCdC > 0) this.rbCdC--;
            if (this.rbCdB > 0) this.rbCdB--;
            if (this.rbStrikeCd > 0) this.rbStrikeCd--;
            if (!this.rbOver && this.hp < 30 && this.hp > 0) {
                this.rbOver = true;
                floatingTexts.push(new FloatingText(this.x, this.y - 40, 'REACTOR OVERLOAD', '255, 183, 77'));
                playChargeSound(0.5);
            }
            const valid = enemy && !enemy.out && !enemy.isFakeDead && !enemy.erased;
            if (!valid) {
                this.rbState = '';
                this.x += this.dx;
                this.y += this.dy;
                return;
            }
            const gap = dist - (this.radius + enemy.radius);

            // --- Испепеление: заряд ладоней и огненный луч ---
            if (this.rbState === 'cannon') {
                this.rbT++;
                this.dx = 0;
                this.dy = 0;
                if (this.rbT < 30) this.rbAng = Math.atan2(enemy.y - this.y, enemy.x - this.x);
                if (this.rbT === 1) playChargeSound(0.7);
                if (this.rbT === 45) playLaserSound();
                if (this.rbT >= 45 && this.rbT < 63) {
                    const ux = Math.cos(this.rbAng), uy = Math.sin(this.rbAng);
                    this.targets().forEach(function (t) {
                        const rx = t.x - self.x, ry = t.y - self.y;
                        const pr = rx * ux + ry * uy, q = Math.abs(rx * uy - ry * ux);
                        if (pr > 0 && q < t.radius + 16) t.dot(0.95 * mul, 'robot_blast');
                    });
                }
                if (this.rbT >= 66) {
                    this.rbState = '';
                    this.rbT = 0;
                    this.rbCdC = this.rbOver ? 180 : 300;
                    this.randomizeVelocity();
                }
                return;
            }

            // --- Град ударов: рывок и серия ударов ---
            if (this.rbState === 'barrage') {
                this.rbT++;
                if (this.rbHits === 0 && gap > 6 && this.rbT < 45) {
                    const dx = enemy.x - this.x, dy = enemy.y - this.y, dd = Math.hypot(dx, dy) || 1;
                    this.dx = dx / dd * 8;
                    this.dy = dy / dd * 8;
                    this.x += this.dx;
                    this.y += this.dy;
                } else if (gap > 16 && this.rbHits === 0) {
                    this.rbState = '';
                    this.rbT = 0;
                    this.rbCdB = 90;
                } else {
                    this.dx = 0;
                    this.dy = 0;
                    enemy.stunTimer = Math.max(enemy.stunTimer, 3);
                    if (this.rbT % 4 === 0 && this.rbHits < 9) {
                        this.rbHits++;
                        this.rbFx = 6;
                        enemy.takeDamage(2.4 * mul, 'robot_punch');
                        playHitSound();
                    }
                    if (this.rbHits >= 9 || this.rbT >= 100) {
                        this.rbState = '';
                        this.rbT = 0;
                        this.rbHits = 0;
                        this.rbCdB = this.rbOver ? 160 : 240;
                        this.randomizeVelocity();
                    }
                }
                return;
            }

            if (this.rbCdC <= 0 && gap > 40 && gap < 330) {
                this.rbState = 'cannon';
                this.rbT = 0;
                this.rbAng = Math.atan2(enemy.y - this.y, enemy.x - this.x);
                floatingTexts.push(new FloatingText(this.x, this.y - 40, 'INCINERATE', '255, 183, 77'));
                return;
            }
            if (this.rbCdB <= 0 && gap < 260) {
                this.rbState = 'barrage';
                this.rbT = 0;
                this.rbHits = 0;
                floatingTexts.push(new FloatingText(this.x, this.y - 40, 'BARRAGE', '255, 138, 101'));
                return;
            }

            // --- Преследование и удары ---
            const spd = this.rbOver ? 4.4 : 3.2;
            const dx = enemy.x - this.x, dy = enemy.y - this.y, dd = Math.hypot(dx, dy) || 1;
            const stp = Math.min(spd, Math.max(0, dd - (this.radius + enemy.radius) + 2));
            this.dx = dx / dd * stp;
            this.dy = dy / dd * stp;
            this.x += this.dx;
            this.y += this.dy;
            if (gap < 6 && this.rbStrikeCd <= 0) {
                this.rbStrikeCd = 30;
                enemy.takeDamage(3 * mul, 'robot');
                playHitSound();
            }
        }

        drawRobot() {
            const r = this.radius;
            const face = this.rbState === 'cannon' ? this.rbAng : Math.atan2(this.dy || 0.001, this.dx || 0.001);
            ctx.save();
            // пластины корпуса
            ctx.beginPath();
            ctx.arc(this.x, this.y, r, 0, Math.PI * 2);
            ctx.clip();
            ctx.strokeStyle = 'rgba(38, 50, 56, 0.55)';
            ctx.lineWidth = 1.5;
            for (let i = -2; i <= 2; i++) {
                ctx.beginPath();
                ctx.moveTo(this.x - r, this.y + i * r * 0.38);
                ctx.lineTo(this.x + r, this.y + i * r * 0.38);
                ctx.stroke();
            }
            ctx.restore();
            ctx.save();
            ctx.translate(this.x, this.y);
            ctx.rotate(face);
            // визор
            ctx.fillStyle = this.rbCoreOut ? '#37474f' : (this.rbOver ? '#ff5252' : '#ffca28');
            ctx.fillRect(r * 0.2, -r * 0.18, r * 0.62, r * 0.36);
            // ладони-пушки
            const charge = this.rbState === 'cannon' ? Math.min(1, this.rbT / 45) : 0;
            [-1, 1].forEach(function (sd) {
                ctx.beginPath();
                ctx.arc(r * 0.1, sd * (r + 3), 5 + charge * 5, 0, Math.PI * 2);
                ctx.fillStyle = '#263238';
                ctx.fill();
                ctx.beginPath();
                ctx.arc(r * 0.1, sd * (r + 3), 2.5 + charge * 6, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(255, 171, 64, ' + (0.6 + 0.4 * charge) + ')';
                ctx.fill();
            });
            ctx.restore();
            // реактор
            if (!this.rbCoreOut) {
                const pulse = 1 + 0.18 * Math.sin(this.wSpin * 6);
                const cg = ctx.createRadialGradient(this.x, this.y + 2, 1, this.x, this.y + 2, r * 0.5 * pulse);
                cg.addColorStop(0, '#fffde7');
                cg.addColorStop(0.5, this.rbOver ? '#ff5252' : '#ffb300');
                cg.addColorStop(1, 'rgba(255, 112, 67, 0)');
                ctx.beginPath();
                ctx.arc(this.x, this.y + 2, r * 0.5 * pulse, 0, Math.PI * 2);
                ctx.fillStyle = cg;
                ctx.fill();
            } else {
                ctx.beginPath();
                ctx.arc(this.x, this.y + 2, r * 0.28, 0, Math.PI * 2);
                ctx.fillStyle = '#101417';
                ctx.fill();
            }
            // огненный луч
            if (this.rbState === 'cannon' && this.rbT >= 45 && this.rbT < 66) {
                const k = this.rbT < 63 ? 1 : (66 - this.rbT) / 3;
                const ex = this.x + Math.cos(this.rbAng) * 700, ey = this.y + Math.sin(this.rbAng) * 700;
                ctx.lineCap = 'round';
                ctx.beginPath();
                ctx.moveTo(this.x, this.y);
                ctx.lineTo(ex, ey);
                ctx.strokeStyle = 'rgba(255, 112, 67, ' + (0.55 * k) + ')';
                ctx.lineWidth = 34 * k;
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(this.x, this.y);
                ctx.lineTo(ex, ey);
                ctx.strokeStyle = 'rgba(255, 224, 130, ' + (0.9 * k) + ')';
                ctx.lineWidth = 16 * k;
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(this.x, this.y);
                ctx.lineTo(ex, ey);
                ctx.strokeStyle = 'rgba(255, 255, 255, ' + k + ')';
                ctx.lineWidth = 6 * k;
                ctx.stroke();
                ctx.lineCap = 'butt';
            }
            // вспышки ударов
            if (this.rbFx > 0) {
                ctx.beginPath();
                ctx.arc(this.x + Math.cos(face) * (r + 8), this.y + Math.sin(face) * (r + 8), 6 + this.rbFx * 2, 0, Math.PI * 2);
                ctx.strokeStyle = 'rgba(255, 213, 79, ' + (this.rbFx / 6) + ')';
                ctx.lineWidth = 3;
                ctx.stroke();
            }
        }

        // Supreme Author — SCP-аномалия: чёрное ядро, кольца содержания, цензура
        drawSupreme() {
            const r = this.radius, t = performance.now() / 700;
            ctx.beginPath();
            ctx.arc(this.x, this.y, r * 0.62, 0, Math.PI * 2);
            ctx.fillStyle = '#050505';
            ctx.fill();
            ctx.lineWidth = 2;
            ctx.strokeStyle = '#ffd54f';
            for (let i = 0; i < 3; i++) {
                const a = t + i * Math.PI * 2 / 3;
                ctx.beginPath();
                ctx.arc(this.x, this.y, r + 13, a, a + 1.2);
                ctx.stroke();
            }
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
            ctx.beginPath();
            ctx.arc(this.x, this.y, r + 19, -t * 1.3, -t * 1.3 + 0.8);
            ctx.stroke();
            // мерцающие чёрные полосы «[REDACTED]» на теле
            if (Math.sin(t * 9) > 0.35) {
                ctx.fillStyle = '#000';
                ctx.fillRect(this.x - r * 0.9, this.y - r * 0.28, r * 1.8, r * 0.2);
                ctx.fillRect(this.x - r * 0.6, this.y + r * 0.18, r * 1.2, r * 0.18);
            }
        }

        // цензура и клетка рисуются поверх всех шаров
        drawSupremeFx() {
            const r = this.radius;
            // цензура на враге
            if (this.rdT > 0 && this.rdTarget) {
                const e = this.rdTarget, er = e.radius;
                ctx.fillStyle = '#000';
                for (let i = -2; i <= 2; i++) ctx.fillRect(e.x - er * 1.1, e.y + i * er * 0.4 - 4, er * 2.2, 8);
                ctx.fillStyle = '#fff';
                ctx.font = 'bold 9px monospace';
                ctx.textAlign = 'center';
                ctx.fillText('[REDACTED]', e.x, e.y + 3);
            }
            // клетка содержания
            if (this.cnT > 0 && this.cnTarget) {
                const e = this.cnTarget, cr = e.radius + 10;
                ctx.strokeStyle = 'rgba(255, 213, 79, 0.9)';
                ctx.lineWidth = 3;
                ctx.strokeRect(e.x - cr, e.y - cr, cr * 2, cr * 2);
                ctx.lineWidth = 2;
                for (let i = -1; i <= 1; i++) {
                    ctx.beginPath();
                    ctx.moveTo(e.x + i * cr * 0.5, e.y - cr);
                    ctx.lineTo(e.x + i * cr * 0.5, e.y + cr);
                    ctx.stroke();
                }
            }
        }

        // ярость One Shot (×1500)
        drawRage(k) {
            const r = this.radius;
            const t = performance.now() / 120;
            const g = ctx.createRadialGradient(this.x, this.y, r * 0.5, this.x, this.y, r + 34 + Math.sin(t) * 5);
            g.addColorStop(0, 'rgba(255, 60, 0, ' + (0.55 * k) + ')');
            g.addColorStop(1, 'rgba(255, 0, 0, 0)');
            ctx.beginPath();
            ctx.arc(this.x, this.y, r + 36, 0, Math.PI * 2);
            ctx.fillStyle = g;
            ctx.fill();
            for (let i = 0; i < 10; i++) {
                const a = i * Math.PI / 5 + t * 0.25;
                const L = (12 + 12 * Math.abs(Math.sin(t + i))) * k;
                ctx.beginPath();
                ctx.moveTo(this.x + Math.cos(a - 0.12) * (r + 2), this.y + Math.sin(a - 0.12) * (r + 2));
                ctx.lineTo(this.x + Math.cos(a) * (r + 6 + L), this.y + Math.sin(a) * (r + 6 + L));
                ctx.lineTo(this.x + Math.cos(a + 0.12) * (r + 2), this.y + Math.sin(a + 0.12) * (r + 2));
                ctx.fillStyle = 'rgba(255, 90, 20, ' + (0.85 * k) + ')';
                ctx.fill();
            }
            if (this.osRage) {
                ctx.fillStyle = '#ff5252';
                ctx.font = 'bold 13px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText('×1500', this.x, this.y + r + 22);
            }
        }

        /* ---------- Cosmic Alien ---------- */
        cmReduce() {
            return Math.min(this.cmFear ? 0.85 : 0.7, this.cmStacks * 0.045);
        }

        // каждое попадание учит его: раз в 20 кадров +1 уровень адаптации
        cmOnHit() {
            if (this.cmAdaptCd > 0 || this.cmStacks >= CM_MAX_STACKS) return;
            this.cmStacks++;
            this.cmAdaptCd = 20;
            if (this.cmStacks % 4 === 0) {
                floatingTexts.push(new FloatingText(this.x, this.y - 34, 'ADAPTATION −' + Math.round(this.cmReduce() * 100) + '%', '179, 136, 255'));
            }
        }

        cmCheckFear() {
            if (this.cmFear || this.hp > CM_FEAR_HP * this.cmMax / 100) return;
            // Космический Страх: полное лечение, скорость и урон ×, 1 сек неуязвимости
            this.cmFear = true;
            this.hp = this.cmMax;
            this.cmInvuln = 70;
            this.cmStacks = Math.max(this.cmStacks, 6);
            this.cmState = '';
            this.cmT = 0;
            this.cmBlast = 30;
            this.cmBlastR = 160;
            floatingTexts.push(new FloatingText(this.x, this.y - 44, 'COSMIC FEAR', '255, 82, 82'));
            playChargeSound(0.5);
        }

        // Копирование: запоминает любой приём, которым по нему попали
        cmLearn(amount, atkType, kind) {
            if (!atkType || atkType.indexOf('cosmic') === 0 || atkType === 'contact' || amount < 0.05) return;
            if (atkType === 'other' && amount <= 1.5) return;
            let e = this.cmLib[atkType];
            if (!e) {
                e = this.cmLib[atkType] = { last: -99, streak: 0, amt: 0, rate: 0, kind: kind, cont: false };
                this.cmLibN++;
                floatingTexts.push(new FloatingText(this.x, this.y - 56, 'COPIED: ' + (atkType === 'other' ? 'move' : atkType === 'oneshot_punch' ? 'SERIOUS PUNCH' : atkType), '179, 136, 255'));
            }
            if (this.cmClock - e.last <= 2) e.streak++; else e.streak = 1;
            e.last = this.cmClock;
            if (e.streak >= 8) e.cont = true;          // бьёт каждый кадр — это луч / постоянный урон
            e.amt = Math.max(e.amt, amount);
            e.rate = e.rate ? e.rate * 0.9 + amount * 0.1 : amount;
            if (kind === 'sure') e.kind = 'sure';
        }

        // Использует скопированный приём — на 25% сильнее оригинала (×1.6 в Страхе)
        cmUseCopy(enemy) {
            const keys = Object.keys(this.cmLib);
            if (!keys.length) return false;
            const name = keys[Math.floor(Math.random() * keys.length)];
            const e = this.cmLib[name];
            const mul = this.cmFear ? 1.6 : 1.25;
            if (name === 'oneshot_punch') { this.cmStartPunch(enemy); return true; }
            floatingTexts.push(new FloatingText(this.x, this.y - 44, 'COPY: ' + (name === 'other' ? 'move' : name), '224, 187, 255'));
            if (e.cont) {
                this.cmState = 'cbeam';
                this.cmT = 0;
                this.cmTarget = enemy;
                this.cmCopy = { name: name, dps: Math.min(0.8, Math.max(0.1, e.rate) * mul), sure: e.kind === 'sure' };
                playLaserSound();
            } else {
                const dmg = Math.min(40, Math.max(4, e.amt) * mul);
                this.cmZap = 14;
                this.cmTarget = enemy;
                if (e.kind === 'sure') enemy.sureHit(dmg, 'cosmic_copy'); else enemy.takeDamage(dmg, 'cosmic_copy');
                if (dmg > 20) playExplosionSound(); else playHitSound();
            }
            return true;
        }

        // Космик применяет скопированный «Серьёзный удар»
        cmStartPunch(enemy) {
            const e = this.cmLib.oneshot_punch;
            const mul = this.cmFear ? 1.6 : 1.25;
            this.opDmg = Math.min(140, Math.max(10, e ? e.amt : 60) * mul);
            this.cmCdP = 360;
            this.cmState = '';
            this.punchStart(enemy);
            floatingTexts.push(new FloatingText(this.x, this.y - 44, 'COPY: SERIOUS PUNCH', '224, 187, 255'));
        }

        /* ---------- «Серьёзный удар»: большой кулак (One Shot и копия Космика) ---------- */
        punchStart(enemy) {
            this.opPhase = 1;
            this.opT = 0;
            this.opId = ++punchSeq;
            this.opTx = enemy.x;
            this.opTy = enemy.y;
            this.dx = 0;
            this.dy = 0;
            if (this.type === 'oneshot') floatingTexts.push(new FloatingText(this.x, this.y - 34, 'SERIOUS PUNCH', '255, 80, 80'));
            playChargeSound(1);
        }

        punchStep(enemy) {
            const self = this;
            this.dx = 0;
            this.dy = 0;
            this.opT++;
            const valid = enemy && !enemy.out && !enemy.isFakeDead && !enemy.erased;
            if (this.opPhase === 1) {
                const wu = this.osRage ? 24 : (this.osSeries ? 30 : 60);
                if (valid && this.opT < wu - 15) { this.opTx = enemy.x; this.opTy = enemy.y; }
                if (this.opT >= wu) {
                    this.opPhase = 2;
                    this.opT = 0;
                    const a = Math.atan2(this.opTy - this.y, this.opTx - this.x);
                    this.opSx = this.x - Math.cos(a) * (this.radius + 14);
                    this.opSy = this.y - Math.sin(a) * (this.radius + 14);
                }
            } else if (this.opPhase === 2 && this.opT >= (this.osRage ? 8 : 14)) {
                const isC = this.type === 'cosmic';
                const dmg = isC ? this.opDmg : (this.osRage ? 60 * 1500 : 60);
                this.opPhase = 0;
                this.opT = 0;
                this.opFx = 18;
                this.opHx = this.opTx;
                this.opHy = this.opTy;
                this.targets().forEach(function (t) {
                    if (Math.hypot(t.x - self.opHx, t.y - self.opHy) < 70 + t.radius) {
                        if (self.osRage && t.type === 'cosmic') { t.cmFear = true; t.cmInvuln = 0; }
                        t.takeDamage(dmg, isC ? 'cosmic_punch' : 'oneshot_punch');
                        const a = Math.atan2(t.y - self.opHy, t.x - self.opHx);
                        if (!t.isGodTier()) {
                            t.x += Math.cos(a) * 35;
                            t.y += Math.sin(a) * 35;
                            t.stunTimer = Math.max(t.stunTimer, 18);
                        }
                    }
                });
                playExplosionSound();
                if (isC) { this.cmCdK = Math.max(this.cmCdK, 120); }
                else { this.oneShotCooldown = 0; this.osSeries = false; this.osQueue = []; this.randomizeVelocity(); }
            }
        }

        drawFistShape(fx, fy, r, ang, fill, edge) {
            ctx.save();
            ctx.translate(fx, fy);
            ctx.rotate(ang);
            ctx.fillStyle = fill;
            ctx.strokeStyle = edge;
            ctx.lineWidth = 3;
            // ладонь
            ctx.beginPath();
            const x0 = -r, x1 = r * 0.55, y0 = -r * 0.8, y1 = r * 0.8, rr = r * 0.3;
            ctx.moveTo(x0 + rr, y0);
            ctx.lineTo(x1 - rr, y0); ctx.arc(x1 - rr, y0 + rr, rr, -Math.PI / 2, 0);
            ctx.lineTo(x1, y1 - rr); ctx.arc(x1 - rr, y1 - rr, rr, 0, Math.PI / 2);
            ctx.lineTo(x0 + rr, y1); ctx.arc(x0 + rr, y1 - rr, rr, Math.PI / 2, Math.PI);
            ctx.lineTo(x0, y0 + rr); ctx.arc(x0 + rr, y0 + rr, rr, Math.PI, Math.PI * 1.5);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            // костяшки
            for (let i = 0; i < 4; i++) {
                ctx.beginPath();
                ctx.arc(x1, -r * 0.6 + i * r * 0.4, r * 0.24, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
            }
            // большой палец
            ctx.beginPath();
            ctx.arc(r * 0.05, r * 0.92, r * 0.26, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            ctx.restore();
        }

        drawPunch() {
            const isC = this.type === 'cosmic';
            const fill = isC ? '#4527a0' : '#151515';
            const edge = isC ? '#e0bbff' : '#ff3333';
            const glow = isC ? '179, 136, 255' : '255, 51, 51';
            if (this.opPhase > 0) {
                const tx = this.opTx, ty = this.opTy;
                const ang = Math.atan2(ty - this.y, tx - this.x);
                const bx = this.x - Math.cos(ang) * (this.radius + 14), by = this.y - Math.sin(ang) * (this.radius + 14);
                let fx, fy, r;
                if (this.opPhase === 1) {
                    const k = Math.min(1, this.opT / 50);
                    r = 10 + 38 * k;
                    fx = bx + (Math.random() - 0.5) * 3 * k;
                    fy = by + (Math.random() - 0.5) * 3 * k;
                    ctx.beginPath();
                    ctx.arc(tx, ty, 70, 0, Math.PI * 2);
                    ctx.setLineDash([6, 6]);
                    ctx.strokeStyle = 'rgba(' + glow + ', ' + (0.15 + 0.5 * k) + ')';
                    ctx.lineWidth = 2;
                    ctx.stroke();
                    ctx.setLineDash([]);
                    ctx.beginPath();
                    ctx.arc(fx, fy, r * 1.5, 0, Math.PI * 2);
                    ctx.fillStyle = 'rgba(' + glow + ', ' + (0.12 + 0.2 * k) + ')';
                    ctx.fill();
                } else {
                    const e = Math.pow(this.opT / 14, 2);
                    fx = bx + (tx - bx) * e;
                    fy = by + (ty - by) * e;
                    r = 48;
                    ctx.beginPath();
                    ctx.moveTo(bx, by);
                    ctx.lineTo(fx, fy);
                    ctx.strokeStyle = 'rgba(' + glow + ', 0.3)';
                    ctx.lineWidth = r * 1.1;
                    ctx.lineCap = 'round';
                    ctx.stroke();
                    ctx.lineCap = 'butt';
                }
                this.drawFistShape(fx, fy, r, ang, fill, edge);
            }
            if (this.opFx > 0) {
                const k = this.opFx / 18;
                ctx.beginPath();
                ctx.arc(this.opHx, this.opHy, 20 + (1 - k) * 110, 0, Math.PI * 2);
                ctx.strokeStyle = 'rgba(' + glow + ', ' + k + ')';
                ctx.lineWidth = 6;
                ctx.stroke();
                ctx.beginPath();
                ctx.arc(this.opHx, this.opHy, 44 * k, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(255, 255, 255, ' + (0.8 * k) + ')';
                ctx.fill();
            }
        }

        updateCosmic(enemy, dist) {
            const self = this;
            const fm = this.cmFear ? 2 : 1;
            this.wSpin += this.cmFear ? 0.09 : 0.04;
            this.cmClock++;
            if (this.cmZap > 0) this.cmZap--;
            if (this.cmCdK > 0) this.cmCdK--;
            if (this.cmAdaptCd > 0) this.cmAdaptCd--;
            if (this.cmInvuln > 0) this.cmInvuln--;
            if (this.cmStrikeCd > 0) this.cmStrikeCd--;
            if (this.cmBlast > 0) this.cmBlast--;
            if (this.cmFx > 0) this.cmFx--;
            if (this.cmCdM > 0) this.cmCdM--;
            if (this.cmCdN > 0) this.cmCdN--;
            if (this.cmCdC > 0) this.cmCdC--;
            if (this.cmCdP > 0) this.cmCdP--;
            if (this.opFx > 0) this.opFx--;

            // регенерация
            this.hp = Math.min(this.cmMax, this.hp + (this.cmFear ? 0.05 : 0.017) * Math.sqrt(this.cmMax / 100));
            this.cmCheckFear();

            // метеориты (идут независимо от состояния)
            for (let i = this.cmMeteors.length - 1; i >= 0; i--) {
                const m = this.cmMeteors[i];
                m.t++;
                if (m.t === 45) {
                    m.boom = 16;
                    this.targets().forEach(function (t) {
                        if (Math.hypot(t.x - m.x, t.y - m.y) < m.r + t.radius) t.takeDamage(9 * fm, 'cosmic_meteor');
                    });
                    playHitSound();
                } else if (m.t > 45) {
                    m.boom--;
                    if (m.boom <= 0) this.cmMeteors.splice(i, 1);
                }
            }

            const valid = enemy && !enemy.out && !enemy.isFakeDead && !enemy.erased;
            if (!valid) {
                this.x += this.dx;
                this.y += this.dy;
                return;
            }
            const gap = dist - (this.radius + enemy.radius);

            // --- «Серьёзный удар» (скопированный) ---
            if (this.opPhase > 0) { this.punchStep(enemy); return; }

            // --- Сверхновая: зарядка с притяжением, затем взрыв ---
            if (this.cmState === 'nova') {
                this.cmT++;
                const pull = 1.8;
                const dx = this.x - enemy.x, dy = this.y - enemy.y, dd = Math.hypot(dx, dy) || 1;
                if (dd > this.radius + enemy.radius + 8 && !enemy.isGodTier()) { enemy.x += dx / dd * pull; enemy.y += dy / dd * pull; }
                if (this.cmT >= 90) {
                    const R = this.cmFear ? 320 : 250;
                    this.cmBlast = 28;
                    this.cmBlastR = R;
                    this.targets().forEach(function (t) {
                        if (Math.hypot(t.x - self.x, t.y - self.y) < R) t.sureHit(22 * fm, 'cosmic_nova');
                    });
                    playExplosionSound();
                    floatingTexts.push(new FloatingText(this.x, this.y - 40, 'SUPERNOVA!', '255, 213, 79'));
                    this.cmState = '';
                    this.cmT = 0;
                    this.cmCdN = this.cmFear ? 600 : 840;
                }
                return;
            }

            // --- Скопированный луч / постоянный приём ---
            if (this.cmState === 'cbeam') {
                this.cmT++;
                this.dx = 0;
                this.dy = 0;
                const cp = this.cmCopy;
                if (cp) {
                    this.targets().forEach(function (t) {
                        if (cp.sure) t.sureHit(cp.dps, 'cosmic_copy'); else t.dot(cp.dps, 'cosmic_copy');
                    });
                }
                if (this.cmT >= 90) {
                    this.cmState = '';
                    this.cmT = 0;
                    this.cmCopy = null;
                    this.cmCdK = this.cmFear ? 200 : 320;
                }
                return;
            }

            // --- Комбо: телепорт и серия ударов ---
            if (this.cmState === 'combo') {
                this.cmT++;
                if (this.cmT === 1) {
                    const a = Math.random() * Math.PI * 2, rr = this.radius + enemy.radius + 2;
                    this.x = enemy.x + Math.cos(a) * rr;
                    this.y = enemy.y + Math.sin(a) * rr;
                    this.cmFx = 14;
                    floatingTexts.push(new FloatingText(this.x, this.y - 30, 'COSMIC STRIKE', '128, 222, 234'));
                }
                if (this.cmT % 6 === 0 && this.cmT <= 30) {
                    enemy.takeDamage(3 * fm, 'cosmic');
                    playHitSound();
                }
                if (this.cmT >= 38) {
                    this.cmState = '';
                    this.cmT = 0;
                    this.cmCdC = this.cmFear ? 150 : 240;
                }
                return;
            }

            // --- Выбор способности ---
            // One Shot замахнулся «Серьёзным ударом» — Космик копирует его и бьёт одновременно
            const osPunch = balls.find(function (b) { return b.type === 'oneshot' && !b.out && b.opPhase === 1; });
            let react = false;
            if (osPunch && this.cmCdP <= 0 && this.cmReactId !== osPunch.opId) {
                this.cmReactId = osPunch.opId;
                if (this.cmLib.oneshot_punch) react = true;
                else if (Math.random() < 0.7) { this.cmLearn(60, 'oneshot_punch', 'hit'); react = true; }
            }
            if (react) {
                this.cmStartPunch(osPunch);
            } else if (this.cmCdN <= 0 && gap < 230) {
                this.cmState = 'nova';
                this.cmT = 0;
                playChargeSound(1.5);
                floatingTexts.push(new FloatingText(this.x, this.y - 44, 'SUPERNOVA…', '255, 213, 79'));
            } else if (this.cmCdC <= 0 && gap > 25) {
                this.cmState = 'combo';
                this.cmT = 0;
            } else if (this.cmCdK <= 0 && this.cmLibN > 0) {
                this.cmCdK = this.cmFear ? 200 : 320;
                this.cmUseCopy(enemy);
            } else if (this.cmCdM <= 0) {
                this.cmCdM = this.cmFear ? 300 : 420;
                this.cmFx = 20;
                for (let i = 0; i < 6; i++) {
                    const aimed = i < 3;
                    const jx = aimed ? 28 : 130, jy = aimed ? 28 : 130;
                    let mx = enemy.x + (Math.random() - 0.5) * 2 * jx, my = enemy.y + (Math.random() - 0.5) * 2 * jy;
                    mx = Math.max(25, Math.min(W - 25, mx)); my = Math.max(25, Math.min(H - 25, my));
                    this.cmMeteors.push({ x: mx, y: my, t: -i * 9, r: 40, boom: 0 });
                }
                floatingTexts.push(new FloatingText(this.x, this.y - 40, 'METEORS!', '255, 138, 101'));
            }

            // --- Преследование и удары ---
            const spd = this.cmFear ? 4.8 : 3.3;
            const dx = enemy.x - this.x, dy = enemy.y - this.y, dd = Math.hypot(dx, dy) || 1;
            const stp = Math.min(spd, Math.max(0, dd - (this.radius + enemy.radius) + 2));
            this.dx = dx / dd * stp;
            this.dy = dy / dd * stp;
            this.x += this.dx;
            this.y += this.dy;
            if (gap < 6 && this.cmStrikeCd <= 0) {
                this.cmStrikeCd = this.cmFear ? 20 : 30;
                enemy.takeDamage(4 * fm, 'cosmic');
                playHitSound();
            }
        }

        /* ---------- Клон: удваивает своё количество ---------- */
        spawnCopy() {
            const c = new Ball(this.x + (Math.random() - 0.5) * 20, this.y + (Math.random() - 0.5) * 20, this.color, 'cloner', this.name, this.label);
            c.isCopy = true;
            c.cloneGroup = this.cloneGroup;
            c.team = this.team;
            c.radius = this.radius;      // точная копия: тот же размер
            c.hp = this.hp;              // и то же здоровье, что у создающего её тела
            c.px = c.x; c.py = c.y;
            c.clAng = Math.random() * Math.PI * 2;
            c.clFx = 20;
            // копия не преследует врага — катится и отскакивает от стен
            const va = Math.random() * Math.PI * 2;
            c.dx = Math.cos(va) * 4.5; c.dy = Math.sin(va) * 4.5;
            balls.push(c);
        }

        updateCloner(enemy, dist) {
            if (this.clFx > 0) this.clFx--;
            if (this.clStrikeCd > 0) this.clStrikeCd--;
            this.wSpin += 0.08;

            // раз в 3 сек каждая копия делает ещё одну → количество ×2
            this.clT++;
            if (this.clT >= CLONER_PERIOD) {
                this.clT = 0;
                const group = this.cloneGroup;
                const cnt = balls.filter(function (b) { return !b.out && b.cloneGroup === group; }).length;
                if (cnt < CLONER_MAX) {
                    this.spawnCopy();
                    this.clFx = 20;
                    if (!this.isCopy) {
                        floatingTexts.push(new FloatingText(this.x, this.y - 30, 'DOUBLING → ×' + Math.min(CLONER_MAX, cnt * 2), '128, 222, 234'));
                        playChargeSound(0.2);
                    }
                }
            }

            const valid = enemy && !enemy.out && !enemy.isFakeDead && !enemy.erased;
            if (!valid) {
                this.x += this.dx;
                this.y += this.dy;
                return;
            }
            {
                // и клон, и настоящий просто отскакивают от стен; бьют врага, только если коснулись его
                if (Math.hypot(this.dx, this.dy) < 3) {
                    const va = Math.random() * Math.PI * 2;
                    this.dx = Math.cos(va) * 4.5; this.dy = Math.sin(va) * 4.5;
                }
                this.x += this.dx;
                this.y += this.dy;
                if (dist - (this.radius + enemy.radius) < 6 && this.clStrikeCd <= 0) {
                    this.clStrikeCd = 40;
                    if (Math.random() < 0.1) enemy.sureHit(2, 'cloner'); else enemy.takeDamage(2, 'cloner');
                    playHitSound();
                }
                return;
            }
            // оригинал занимает своё место вокруг врага и бьёт
            const rr = this.radius + enemy.radius + 1;
            const tx = enemy.x + Math.cos(this.clAng) * rr;
            const ty = enemy.y + Math.sin(this.clAng) * rr;
            const ddx = tx - this.x, ddy = ty - this.y;
            const dd = Math.hypot(ddx, ddy);
            // вдали догоняет рывком, вблизи идёт ровно
            const spd = Math.min(16, Math.max(3.4, dd * 0.22));
            const stp = Math.min(spd, dd);
            if (dd > 0) {
                this.dx = ddx / dd * stp;
                this.dy = ddy / dd * stp;
                this.x += this.dx;
                this.y += this.dy;
            }
            if (dist - (this.radius + enemy.radius) < 6 && this.clStrikeCd <= 0) {
                this.clStrikeCd = 40;
                // каждый десятый удар копии пробивает уклонение
                if (Math.random() < 0.1) enemy.sureHit(2, 'cloner'); else enemy.takeDamage(2, 'cloner');
                playHitSound();
            }
        }

        /* ---------- Doubling: удваивает себя ---------- */
        updateDoubling(enemy, dist) {
            const self = this;
            this.wSpin += 0.06;
            if (this.dbFx > 0) this.dbFx--;
            if (this.dbStrikeCd > 0) this.dbStrikeCd--;

            // каждые 2 сек: характеристики ×2 (урон, HP, скорость) и волна удвоения по всем врагам
            this.dbT++;
            if (this.dbT >= 120 && this.dbMul < DOUBLING_MAX) {
                this.dbT = 0;
                this.dbMul *= 2;
                this.hp *= 2;
                this.dbSpeed = Math.min(WALLY_CAP, this.dbSpeed * 2);
                this.dbFx = 30;
                floatingTexts.push(new FloatingText(this.x, this.y - 34, 'DOUBLING ×' + doublingFmt(this.dbMul), '206, 147, 255'));
                playChargeSound(0.3);
                const pulse = 3 * this.dbMul;
                this.targets().forEach(function (e) { e.sureHit(pulse, 'doubling_pulse'); });
            }

            const valid = enemy && !enemy.out && !enemy.isFakeDead && !enemy.erased;
            if (!valid) {
                this.x += this.dx;
                this.y += this.dy;
                return;
            }
            // подлетает вплотную и кружит вокруг врага, нанося удары
            const gap = dist - (this.radius + enemy.radius);
            if (gap > 4) {
                const stp = Math.min(this.dbSpeed, gap);
                const a = Math.atan2(enemy.y - this.y, enemy.x - this.x);
                this.x += Math.cos(a) * stp;
                this.y += Math.sin(a) * stp;
                this.dbAng = Math.atan2(this.y - enemy.y, this.x - enemy.x);
            } else {
                this.dbAng += 0.12;
                const rr = this.radius + enemy.radius + 1;
                this.x = enemy.x + Math.cos(this.dbAng) * rr;
                this.y = enemy.y + Math.sin(this.dbAng) * rr;
                if (this.dbStrikeCd <= 0) {
                    this.dbStrikeCd = 30;
                    enemy.takeDamage(4 * this.dbMul, 'doubling');
                    playHitSound();
                }
            }
        }

        /* ---------- Роблокс Егор ---------- */
        // Отрицание + Адаптация + Копирование способностей
        egorBlocks(amount, atkType) {
            atkType = atkType || 'other';
            const lethal = amount >= this.hp;
            const M = this.egMul;
            if (this.egAdapt[atkType] || lethal || M > 1 || Math.random() < 0.85) {
                if (this.egBlockTxt <= 0) {
                    this.egBlockTxt = 25;
                    floatingTexts.push(new FloatingText(this.x, this.y - 22, this.egAdapt[atkType] ? 'ADAPTATION' : 'NEGATION', '240, 240, 240'));
                }
                if (atkType !== 'egor_return' && amount >= 1 && Math.random() < (M > 1 ? 1 : 0.5)) {
                    let e = null, best = Infinity;
                    const me = this;
                    this.targets().forEach(function (t) {
                        const d = Math.hypot(t.x - me.x, t.y - me.y);
                        if (d < best) { best = d; e = t; }
                    });
                    if (e) {
                        floatingTexts.push(new FloatingText(this.x, this.y - 40, 'SAME ATTACK BACK', '255, 214, 0'));
                        e.takeDamage(Math.min(25, amount) * M, 'egor_return');
                    }
                }
                return true;
            }
            // пережил удар — теперь этот тип атаки против него бесполезен навсегда
            this.egAdapt[atkType] = true;
            floatingTexts.push(new FloatingText(this.x, this.y - 34, 'ADAPTED', '255, 214, 0'));
            return false;
        }

        // 25%: раунд начался с кресла Мёбиуса — Егор встаёт, и все его способности ×1000
        egorStandUp() {
            const M = this.egMul;
            this.hp = 100 * M;
            this.egSpeed = 14 * M;
            this.wStandFx = 40;
            if (this.dx === 0 && this.dy === 0) this.randomizeVelocity();
            floatingTexts.push(new FloatingText(this.x, this.y - 40, 'EGOR ROSE FROM THE MÖBIUS CHAIR!', '178, 255, 89'));
            floatingTexts.push(new FloatingText(this.x, this.y - 58, 'ALL ABILITIES ×1000', '255, 255, 255'));
            playTimeStopSound();
        }

        egorAim(goal) {
            let ca = Math.hypot(this.dx, this.dy) > 0.01 ? Math.atan2(this.dy, this.dx) : Math.random() * Math.PI * 2;
            if (goal) {
                let d = Math.atan2(goal.y - this.y, goal.x - this.x) - ca;
                while (d > Math.PI) d -= Math.PI * 2;
                while (d < -Math.PI) d += Math.PI * 2;
                ca += d * 0.35;
            }
            this.dx = Math.cos(ca) * this.egSpeed;
            this.dy = Math.sin(ca) * this.egSpeed;
        }

        updateEgor(enemy, dist) {
            const self = this;
            if (this.egBlockTxt > 0) this.egBlockTxt--;
            this.wSpin += 0.05;
            const M = this.egMul;
            const valid = enemy && !enemy.out && !enemy.isFakeDead && !enemy.erased;

            // скорость: ×2 каждые 0,5 сек до предела 50000 px/сек
            this.egSpeedT++;
            if (this.egSpeedT >= 30) {
                this.egSpeedT = 0;
                // предел 50000 px/сек, в истинной форме — 1 000 000 px/сек
                this.egSpeed = Math.min((this.egTrueUsed ? 1000000 / 60 : WALLY_CAP) * M, this.egSpeed * 2);
            }

            // клоны гоняются за врагом
            this.egClones.forEach(function (c) {
                c.life--;
                if (c.cd > 0) c.cd--;
                let t = null, best = Infinity;
                self.targets().forEach(function (e) {
                    const d = Math.hypot(e.x - c.x, e.y - c.y);
                    if (d < best) { best = d; t = e; }
                });
                if (t) {
                    const a = Math.atan2(t.y - c.y, t.x - c.x);
                    const stp = Math.min(9 * M, best);
                    c.x += Math.cos(a) * stp;
                    c.y += Math.sin(a) * stp;
                    if (best <= 18 + t.radius && c.cd <= 0) {
                        c.cd = 30;
                        t.takeDamage(12 * M, 'egor_clone');
                        playHitSound();
                    }
                }
            });
            this.egClones = this.egClones.filter(function (c) { return c.life > 0; });
            // микро-клон разрывает врага изнутри
            if (this.egMicro > 0) {
                this.egMicro--;
                const mt = this.egMicroT;
                if (mt && !mt.out && !mt.erased) mt.dot(0.4 * M, 'egor_micro');
            }

            // Истинная форма: один раз, когда осталось ≤30 HP
            if (!this.egTrueUsed && this.hp <= 30 * M && this.egPhase !== 'true') {
                this.egTrueUsed = true;
                this.egPhase = 'true';
                this.egTimer = 0;
                this.hp = 10000 * M;                    // истинная форма: 10000 HP (×1000 с кресла)
                this.egSpeed = Math.max(this.egSpeed, 1000 * M);   // и предел скорости 1 000 000 px/сек
                floatingTexts.push(new FloatingText(this.x, this.y - 46, 'TRUE FORM: 10000 HP', '255, 255, 255'));
                playTimeStopSound();
            }
            if (this.egPhase === 'true') {
                this.egTimer++;
                this.dx = 0; this.dy = 0;
                this.x += (W / 2 - this.x) * 0.1;
                this.y += (H / 2 - this.y) * 0.1;
                if (this.egTimer >= 240) {
                    this.egPhase = '';
                    this.egTimer = 0;
                    floatingTexts.push(new FloatingText(W / 2, H / 2 - 40, 'THE WHOLE OMNIVERSE COLLAPSED INTO EGOR', '255, 255, 255'));
                    playExplosionSound();
                    this.targets().forEach(function (e) { e.sureHit(9999 * M, 'egor_true'); });
                }
                return;
            }

            if (this.egPhase === 'verse') {
                // создаёт вселенную, где никто не выживет
                this.egTimer++;
                this.dx = 0; this.dy = 0;
                if (this.egTimer >= 100) {
                    this.egPhase = '';
                    this.egTimer = 0;
                    this.egCd2 = 0;
                    floatingTexts.push(new FloatingText(W / 2, H / 2 - 40, 'MULTIVERSE CREATED', '255, 255, 255'));
                    playExplosionSound();
                    this.targets().forEach(function (e) { e.sureHit(55 * M, 'egor_verse'); });
                }
                return;
            }

            // движение: к чипсам, если есть, иначе к врагу
            this.egorAim(valid ? enemy : null);
            this.wallyFoldMove();

            if (!valid) return;
            this.egCd1++;
            this.egCd2++;
            this.egMeme++;
            if (this.egMeme >= 600) {
                this.egMeme = 0;
                this.heal(20 * M);
                enemy.sureHit(10 * M, 'egor_meme');
                floatingTexts.push(new FloatingText(this.x, this.y - 40, 'MEME: EGOR IS STRONGEST', '255, 214, 0'));
            }
            if (this.egCd2 >= 1200) {
                this.egPhase = 'verse';
                this.egTimer = 0;
                floatingTexts.push(new FloatingText(this.x, this.y - 40, 'CREATING THE MULTIVERSE...', '255, 255, 255'));
                playChargeSound(0.6);
            } else if (this.egCd1 >= 300) {
                this.egCd1 = 0;
                if (this.egCloneKind % 2 === 0) {
                    this.egClones.push({ x: this.x, y: this.y, life: 300, cd: 0 });
                    floatingTexts.push(new FloatingText(this.x, this.y - 40, 'CLONE A BILLION TIMES STRONGER', '255, 255, 255'));
                } else {
                    this.egMicro = 120;
                    this.egMicroT = enemy;
                    floatingTexts.push(new FloatingText(enemy.x, enemy.y - 34, 'MICRO-CLONE INSIDE', '255, 255, 255'));
                }
                this.egCloneKind++;
            }
        }

        /* ---------- Уолли Уэст ---------- */
        resetWally() {
            this.wPhase = '';
            this.wTimer = 0;
            this.wTarget = null;
            if (this.dx === 0 && this.dy === 0) this.randomizeVelocity();
        }

        // скорость задаётся длиной вектора, направление мягко тянется к врагу
        wallyAimVel(enemy) {
            let ca = Math.hypot(this.dx, this.dy) > 0.01 ? Math.atan2(this.dy, this.dx) : Math.random() * Math.PI * 2;
            if (enemy && !enemy.out && !enemy.isFakeDead && !enemy.erased) {
                let d = Math.atan2(enemy.y - this.y, enemy.x - this.x) - ca;
                while (d > Math.PI) d -= Math.PI * 2;
                while (d < -Math.PI) d += Math.PI * 2;
                ca += d * 0.06;
            }
            this.dx = Math.cos(ca) * this.wSpeed;
            this.dy = Math.sin(ca) * this.wSpeed;
        }

        // пассив: скорость ×2 каждую секунду, предел 50000 px/сек
        wallySpeedStep() {
            this.wSpeedT++;
            if (this.wSpeedT >= 60) {
                this.wSpeedT = 0;
                if (this.wSpeed < WALLY_CAP) {
                    this.wSpeed = Math.min(WALLY_CAP, this.wSpeed * 2);
                    floatingTexts.push(new FloatingText(this.x, this.y - 30, 'SPEED ×2', '129, 212, 250'));
                }
            }
        }

        // движение с точными отскоками от стен; big — стены большой арены 5000×5000 (бой с Чёрным Флэшем)
        wallyFoldMove(big) {
            const r = this.radius, x0 = this.x, y0 = this.y, ux = this.dx, uy = this.dy;
            const wbn = worldBounds(this);
            const loX = (wbn ? wbn[0] : 0) + r, hiX = (wbn ? wbn[1] : W) - r;
            const loY = (wbn ? wbn[0] : 0) + r, hiY = (wbn ? wbn[1] : H) - r;
            const fold = function (p, lo, hi) {
                const range = hi - lo;
                let q = (p - lo) % (2 * range);
                if (q < 0) q += 2 * range;
                return q > range ? lo + 2 * range - q : lo + q;
            };
            const odd = function (p, lo, hi) {
                return ((Math.floor((p - lo) / (hi - lo)) % 2) + 2) % 2 === 1;
            };
            const nx = x0 + ux, ny = y0 + uy;
            const sp = Math.hypot(ux, uy);
            if (sp > 3.5) {
                const n = Math.min(24, Math.max(1, Math.ceil(sp / 25)));
                for (let i = 1; i <= n; i++) {
                    this.afterimages.push({
                        x: fold(x0 + ux * i / (n + 1), loX, hiX),
                        y: fold(y0 + uy * i / (n + 1), loY, hiY),
                        life: 6
                    });
                }
            }
            this.x = fold(nx, loX, hiX);
            this.y = fold(ny, loY, hiY);
            if (odd(nx, loX, hiX)) this.dx = -this.dx;
            if (odd(ny, loY, hiY)) this.dy = -this.dy;
        }

        // 25%: раунд начался с кресла Мёбиуса — встаёт полным здоровьем и сразу на огромной скорости
        wallyStandUp() {
            this.wSpeed = Math.max(this.wSpeed, 50);
            this.wSpeedT = 0;
            this.wStandFx = 40;
            if (this.dx === 0 && this.dy === 0) this.randomizeVelocity();
            floatingTexts.push(new FloatingText(this.x, this.y - 40, 'ROSE FROM THE MÖBIUS CHAIR!', '129, 212, 250'));
            floatingTexts.push(new FloatingText(this.x, this.y - 58, 'CHAIR BUFF: HEALING +250%', '105, 240, 174'));
            playTimeStopSound();
        }

        // лечение 35 HP каждые 3 сек; с баффом кресла Мёбиуса — на 250% быстрее (в 3,5 раза чаще)
        wallyHealStep() {
            this.wHealT += this.wChair ? 3.5 : 1;
            if (this.wHealT >= 180) {
                this.wHealT = 0;
                if (this.hp < 100) {
                    this.heal(35);
                    floatingTexts.push(new FloatingText(this.x, this.y - 22, '+35 HP', '105, 240, 174'));
                }
            }
        }

        worldClamp() {
            const wbn = worldBounds(this);
            const lo = (wbn ? wbn[0] : 0) + this.radius, hi = (wbn ? wbn[1] : W) - this.radius;
            this.x = Math.max(lo, Math.min(hi, this.x));
            this.y = Math.max(lo, Math.min(hi, this.y));
        }

        wallyPlaceAt(t) {
            const reach = this.radius + t.radius + 2;
            this.x = t.x + Math.cos(this.wAng) * reach;
            this.y = t.y + Math.sin(this.wAng) * reach;
            this.worldClamp();
        }

        // шквал: kind 1 — после телепорта (6 ударов по 4), kind 3 — обычный (5 ударов по 5 за 0,5 сек)
        wallyStartFlurry(t, kind) {
            this.wPhase = 'flurry';
            this.wKind = kind;
            this.wTimer = 0;
            this.wHitsDone = 0;
            this.wTarget = t;
            if (kind === 1) {
                // «сзади» — против направления движения цели
                const sp = Math.hypot(t.dx, t.dy);
                this.wAng = sp > 0.3 ? Math.atan2(-t.dy, -t.dx) : Math.atan2(this.y - t.y, this.x - t.x) + Math.PI;
                this.afterimages.push({ x: this.x, y: this.y, life: 14 });
                this.wallyPlaceAt(t);
                this.afterimages.push({ x: this.x, y: this.y, life: 14 });
                floatingTexts.push(new FloatingText(this.x, this.y - 34, 'BEHIND YOU!', '129, 212, 250'));
                playLaserSound();
            } else {
                this.wAng = Math.atan2(this.y - t.y, this.x - t.x);
                floatingTexts.push(new FloatingText(this.x, this.y - 34, 'FLURRY OF BLOWS!', '129, 212, 250'));
            }
        }

        wallyKill(v) {
            floatingTexts.push(new FloatingText(v.x, v.y - 30, 'INFINITE MASS', '255, 80, 80'));
            if (v.type === 'muha2' && !v.isUntouchable() && !v.isFakeDead) {
                v.hp = 0;   // даже 10 «жизней» не спасают от бесконечной массы
            } else {
                v.sureHit(9999, 'infmass');
            }
            playExplosionSound();
        }

        /* ---------- Чёрный Флэш: смерть для спидстеров ---------- */
        // перемещение мелкими шагами: на огромной скорости шар не должен «пролетать» сквозь цель
        bfAdvance(vx, vy, target) {
            const len = Math.hypot(vx, vy);
            const n = Math.min(140, Math.max(1, Math.ceil(len / 12)));
            let sx = vx / n, sy = vy / n;
            const r = this.radius;
            const lo = (bigFightOn() ? BIG_LO : 0) + r, hi = (bigFightOn() ? BIG_HI : W) - r;
            for (let i = 0; i < n; i++) {
                this.x += sx;
                this.y += sy;
                if (this.x < lo) { this.x = lo; sx = Math.abs(sx); this.dx = Math.abs(this.dx); }
                else if (this.x > hi) { this.x = hi; sx = -Math.abs(sx); this.dx = -Math.abs(this.dx); }
                if (this.y < lo) { this.y = lo; sy = Math.abs(sy); this.dy = Math.abs(this.dy); }
                else if (this.y > hi) { this.y = hi; sy = -Math.abs(sy); this.dy = -Math.abs(this.dy); }
                if (i % 4 === 0) this.bfTrail.push({ x: this.x, y: this.y, life: 12 });
                if (target && Math.hypot(target.x - this.x, target.y - this.y) <= r + target.radius + 12) return true;
            }
            return false;
        }

        updateBlackFlash(enemy, dist) {
            this.bfCooldown++;
            this.bfTimer++;
            // скорость ×3 каждые 2 сек, предел 50000 px/сек
            this.bfSpeedT++;
            if (this.bfSpeedT >= 120) {
                this.bfSpeedT = 0;
                if (this.bfSpeed < WALLY_CAP) {
                    this.bfSpeed = Math.min(WALLY_CAP, this.bfSpeed * 3);
                    floatingTexts.push(new FloatingText(this.x, this.y - 30, 'SPEED ×3', '255, 35, 75'));
                }
            }
            this.bfTrail.push({x:this.x, y:this.y, life:12});
            while (this.bfTrail.length > 40) this.bfTrail.shift();
            this.bfTrail.forEach(p => p.life--);
            this.bfTrail = this.bfTrail.filter(p => p.life > 0);

            const speedsters = this.targets().filter(v =>
                !v.out && !v.erased && !v.isFakeDead &&
                (v.type === 'wally' || v.type === 'naoya') &&
                !v.isUntouchable()
            );
            const candidates = speedsters.length ? speedsters : this.targets().filter(v =>
                !v.out && !v.erased && !v.isFakeDead && !v.isUntouchable() && v.type !== 'oneshot'
            );
            if (!candidates.length) { this.dx *= 0.96; this.dy *= 0.96; return; }
            let target = candidates[0], best = Infinity;
            candidates.forEach(v => {
                const d = Math.hypot(v.x-this.x, v.y-this.y);
                if (d < best) { best=d; target=v; }
            });
            this.bfTarget = target;
            const angle = Math.atan2(target.y-this.y, target.x-this.x);
            this.bfAngle = angle;

            if (this.bfPhase === 'dash') {
                this.bfTimer++;
                const dashSpeed = Math.min(WALLY_CAP, Math.max(13, this.bfSpeed * 1.6));
                this.dx = Math.cos(this.bfAngle) * dashSpeed;
                this.dy = Math.sin(this.bfAngle) * dashSpeed;
                const bfHit = this.bfAdvance(this.dx, this.dy, this.bfMissed ? null : target);
                if (bfHit && target.type === 'wally' && target.tryDodge(9999)) {
                    // Уолли ушёл из-под удара: Флэш пролетает насквозь, но рывок не обрывается
                    this.bfMissed = true;
                } else if (bfHit) {
                    if (target.type === 'wally' || target.type === 'naoya') {
                        target.hp = 0; target.out = true;
                        floatingTexts.push(new FloatingText(target.x,target.y-32,'BLACK FLASH — SPEEDSTER DEATH!','255, 35, 75'));
                    } else {
                        target.takeDamage(38,'blackflash');
                        floatingTexts.push(new FloatingText(target.x,target.y-28,'BLACK FLASH STRIKE','255, 35, 75'));
                    }
                    playExplosionSound();
                    this.bfPhase = ''; this.bfCooldown = 0; this.bfTimer = 0;
                    this.randomizeVelocity();
                    return;
                }
                if (this.bfTimer >= 28) {
                    this.bfPhase = ''; this.bfCooldown = 0; this.bfTimer = 0;
                    this.randomizeVelocity();
                }
                return;
            }

            const speed = this.bfSpeed * (speedsters.length ? 1 : 0.6);
            this.dx += (Math.cos(angle)*speed-this.dx)*0.11;
            this.dy += (Math.sin(angle)*speed-this.dy)*0.11;
            this.bfAdvance(this.dx, this.dy, null);

            if (this.bfCooldown >= 150 && best < Math.max(245, Math.min(WALLY_CAP, this.bfSpeed * 1.6) * 20)) {
                this.bfPhase = 'dash'; this.bfTimer = 0; this.bfMissed = false;
                floatingTexts.push(new FloatingText(this.x,this.y-34,
                    speedsters.length ? 'HE COMES FOR THE SPEEDSTER...' : 'BLACK FLASH!', '255,35,75'));
                playChargeSound(0.35);
            }
        }

        updateWally(enemy, dist) {
            const self = this;
            this.wSpin += 0.05;
            this.wallySpeedStep();
            this.wallyHealStep();
            this.wCd1++;
            this.wCd2++;
            this.wCd3++;
            const valid = enemy && !enemy.out && !enemy.isFakeDead && !enemy.erased;
            const t = this.wTarget;
            const tOk = t && !t.out && !t.erased && !t.isFakeDead;

            if (this.wPhase === 'flurry') {
                if (!tOk) { this.resetWally(); return; }
                this.wTimer++;
                this.wallyPlaceAt(t);
                if (this.wTimer % 2 === 0) this.afterimages.push({ x: this.x, y: this.y, life: 6 });
                if (this.wTimer % 6 === 0) {
                    t.takeDamage(this.wKind === 1 ? 4 : 5, 'wally');
                    playHitSound();
                    this.wHitsDone++;
                    this.wAng += (Math.random() - 0.5) * 0.9;   // мелькает вокруг цели
                    if (this.wHitsDone >= (this.wKind === 1 ? 6 : 5)) {
                        if (this.wKind === 1) this.wCd1 = 0; else this.wCd3 = 0;
                        this.wPhase = '';
                        this.wTarget = null;
                        this.wallyAimVel(null);
                    }
                }
                return;
            }

            if (this.wPhase === 'mass') {
                // накапливает бесконечную массу
                this.wTimer++;
                if (valid) this.wTarget = enemy;
                if (this.wTimer >= 36) { this.wPhase = 'lunge'; this.wTimer = 0; playLaserSound(); }
                return;
            }

            if (this.wPhase === 'lunge') {
                this.wTimer++;
                const e = valid ? enemy : null;
                if (e) {
                    const a = Math.atan2(e.y - this.y, e.x - this.x);
                    this.x += Math.cos(a) * 24;
                    this.y += Math.sin(a) * 24;
                    this.worldClamp();
                    this.afterimages.push({ x: this.x, y: this.y, life: 10 });
                    if (Math.hypot(e.x - this.x, e.y - this.y) <= this.radius + e.radius + 2) {
                        this.wallyKill(e);
                        this.wPhase = '';
                        this.wTarget = null;
                        this.wCd2 = 0;
                        this.wallyAimVel(null);
                        return;
                    }
                }
                if (this.wTimer >= 45 || !e) {
                    this.wPhase = '';
                    this.wTarget = null;
                    this.wCd2 = 450;   // промахнулся — перезарядка короче
                    this.wallyAimVel(null);
                }
                return;
            }

            // обычное движение: летит к врагу на всей скорости
            this.wallyAimVel(valid ? enemy : null);
            this.wallyFoldMove();

            if (!valid) return;
            if (this.wCd2 >= 900) {
                this.wPhase = 'mass';
                this.wTimer = 0;
                this.wCd2 = 0;
                this.wTarget = enemy;
                floatingTexts.push(new FloatingText(this.x, this.y - 34, 'INFINITE MASS...', '255, 80, 80'));
                playChargeSound(0.6);
            } else if (this.wCd1 >= 300) {
                this.wCd1 = 0;
                this.wallyStartFlurry(enemy, 1);
            } else if (this.wCd3 >= 150 && dist <= this.radius + enemy.radius + 60 + Math.min(300, this.wSpeed * 2)) {
                this.wCd3 = 0;
                this.wallyStartFlurry(enemy, 3);
            }
        }

        /* ---------- Наоя Дзэнин: Проекция ---------- */
        resetNaoya() {
            const t = this.naoyaTarget;
            // если жертва заморожена нами — отпускаем
            if (this.naoyaPhase === 'combo' && t && t.stunTimer <= 3) t.stunTimer = 0;
            this.naoyaPhase = '';
            this.naoyaTimer = 0;
            this.naoyaTarget = null;
            this.naoyaCd = 0;
            if (this.dx === 0 && this.dy === 0) this.randomizeVelocity();
        }

        // касание на рывке: удар + шанс заморозить («не успел принять позу за 1 кадр»)
        naoyaStrike(victim) {
            const before = victim.hp;
            victim.takeDamage(10, 'naoya');
            playHitSound();
            const landed = victim.hp < before;   // уворот / бессмертие / неуязвимость — заморозки нет
            this.naoyaTarget = victim;
            this.naoyaTimer = 0;
            if (landed && Math.random() < 0.7) {
                victim.stunTimer = Math.max(victim.stunTimer, 60);
                this.naoyaPhase = 'combo';
                floatingTexts.push(new FloatingText(victim.x, victim.y - 34, 'FROZEN: PROJECTION', '255, 224, 130'));
            } else {
                this.naoyaPhase = '';
                this.naoyaCd = 90;
                this.naoyaTarget = null;
                floatingTexts.push(new FloatingText(this.x, this.y - 34, landed ? 'POSE IN TIME!' : 'MISS', '255, 224, 130'));
                this.randomizeVelocity();
            }
        }

        // Аои Тодо: катится, бьёт тяжёлыми кулаками и хлопает — «Буги-Вуги» меняет места.
        // Вместе с Юджи в одной команде («братья») хлопает на 25% быстрее.
        // Ультра Инстинкт: тело уворачивается само (не работает против гарантированных попаданий и DoT)
        gokuDodge() {
            if (this.gkUI <= 0 || this.gkKame > 0) return false;
            if (Math.random() >= (this.gkUI >= 2 ? 0.99 : 0.45)) return false;
            this.gkGhost = { x: this.x, y: this.y, t: 16 };
            const a = Math.random() * Math.PI * 2;
            this.x += Math.cos(a) * 34; this.y += Math.sin(a) * 34;
            this.x = Math.max(this.radius, Math.min(W - this.radius, this.x));
            this.y = Math.max(this.radius, Math.min(H - this.radius, this.y));
            if (this.gkDodgeCd <= 0) {
                this.gkDodgeCd = 25;
                floatingTexts.push(new FloatingText(this.x, this.y - 30, 'DODGED!', '207, 216, 220'));
            }
            if (this.gkUI >= 2) this.gkPunchCd = 0;   // мастер: тут же контратака
            return true;
        }

        // Гоку: летит к врагу, серия ударов, Камехамеха, Мгновенное перемещение;
        // при HP < 50% — Ультра Инстинкт (знак), при HP < 25% — освоенный (мастер)
        updateGoku(enemy, dist) {
            if (!this.gkMax) {
                this.gkMax = this.hp;
                // 50% шанс: Гоку появляется сразу в освоенном Ультра Инстинкте
                if (Math.random() < 0.5) {
                    this.gkUI = 2; this.gkFlash = 60;
                    floatingTexts.push(new FloatingText(this.x, this.y - 40, 'MASTERED ULTRA INSTINCT!', '224, 247, 250'));
                    playChargeSound(1);
                }
            }
            const pct = this.hp / this.gkMax;
            if (this.gkUI < 1 && pct < 0.5) {
                this.gkUI = 1; this.gkFlash = 50;
                floatingTexts.push(new FloatingText(this.x, this.y - 40, 'ULTRA INSTINCT -SIGN-', '207, 216, 220'));
                playChargeSound(0.8);
            }
            if (this.gkUI === 1 && pct < 0.25) {
                this.gkUI = 2; this.gkFlash = 60;
                floatingTexts.push(new FloatingText(this.x, this.y - 40, 'MASTERED ULTRA INSTINCT!', '224, 247, 250'));
                playChargeSound(1);
            }
            // «Соперники»: если рядом в команде Вегета — Камехамеха и перемещение на 25% быстрее
            const vgAlly = balls.find(function (o) { return o.type === 'vegeta' && !o.out && o !== this && this.isAlly(o); }, this);
            this.gkRival = !!vgAlly;
            const rv = vgAlly ? 1.25 : 1;
            this.gkPunchCd--; this.gkCd--; this.gkItCd--;
            if (this.gkPunchT > 0) this.gkPunchT--;
            if (this.gkFlash > 0) this.gkFlash--;
            if (this.gkDodgeCd > 0) this.gkDodgeCd--;
            if (this.gkBeamT > 0) this.gkBeamT--;
            if (this.gkGhost) { this.gkGhost.t--; if (this.gkGhost.t <= 0) this.gkGhost = null; }
            const ui = this.gkUI;
            const valid = enemy && !enemy.out && !enemy.isFakeDead && !enemy.erased;

            // заряд Камехамехи: стоит на месте
            if (this.gkKame > 0) {
                this.dx = 0; this.dy = 0;
                if (valid) this.gkAng = Math.atan2(enemy.y - this.y, enemy.x - this.x);
                this.gkKame--;
                if (this.gkKame === 0 && valid) {
                    this.gkBeamT = 16;
                    this.gkAng = Math.atan2(enemy.y - this.y, enemy.x - this.x);
                    enemy.takeDamage(30 * (ui ? 1.3 : 1) * (this.gkPow ? GK_POW : 1) * (this.gkRage ? 3 : 1), 'goku_kame');
                    floatingTexts.push(new FloatingText(enemy.x, enemy.y - 26, 'KAMEHAMEHA!', '100, 181, 246'));
                    playLaserSound(); playExplosionSound();
                }
                return;
            }
            if (valid && this.gkCd <= 0 && dist > 120) {
                this.gkKame = 45;
                this.gkCd = Math.round((ui ? 200 : 280) / rv);
                floatingTexts.push(new FloatingText(this.x, this.y - 34, 'KA-ME-HA-ME…', '100, 181, 246'));
                playChargeSound(0.6);
                return;
            }
            // Мгновенное перемещение: появляется рядом с врагом и сразу бьёт
            if (valid && this.gkItCd <= 0 && dist > 90) {
                this.gkItCd = Math.round((ui ? 110 : 170) / rv);
                this.gkGhost = { x: this.x, y: this.y, t: 16 };
                const a = Math.random() * Math.PI * 2;
                const d = this.radius + enemy.radius + 4;
                this.x = Math.max(this.radius, Math.min(W - this.radius, enemy.x + Math.cos(a) * d));
                this.y = Math.max(this.radius, Math.min(H - this.radius, enemy.y + Math.sin(a) * d));
                this.gkPunchCd = 0;
                if (vgAlly && Math.random() < 0.5) {
                    // Вегета тоже оказывается вплотную к врагу и сразу бьёт
                    const a2 = Math.random() * Math.PI * 2;
                    const d3 = vgAlly.radius + enemy.radius + 4;
                    vgAlly.x = Math.max(vgAlly.radius, Math.min(W - vgAlly.radius, enemy.x + Math.cos(a2) * d3));
                    vgAlly.y = Math.max(vgAlly.radius, Math.min(H - vgAlly.radius, enemy.y + Math.sin(a2) * d3));
                    vgAlly.vgPunchCd = 0;
                    floatingTexts.push(new FloatingText(this.x, this.y - 34, 'INSTANT TRANSMISSION — RIVAL!', '255, 213, 79'));
                } else {
                    floatingTexts.push(new FloatingText(this.x, this.y - 34, 'INSTANT TRANSMISSION!', '255, 183, 77'));
                }
                playChargeSound(0.25);
            }
            // полёт к врагу
            const spd = 3.6 + ui * 0.9;
            if (valid) {
                const a = Math.atan2(enemy.y - this.y, enemy.x - this.x);
                this.dx = this.dx * 0.82 + Math.cos(a) * spd * 0.18;
                this.dy = this.dy * 0.82 + Math.sin(a) * spd * 0.18;
            } else if (Math.hypot(this.dx, this.dy) < 2) {
                const va = Math.random() * Math.PI * 2;
                this.dx = Math.cos(va) * spd; this.dy = Math.sin(va) * spd;
            }
            this.x += this.dx;
            this.y += this.dy;
            // серия ударов
            if (valid) {
                const d2 = Math.hypot(enemy.x - this.x, enemy.y - this.y);
                if (d2 < this.radius + enemy.radius + 12 && this.gkPunchCd <= 0) {
                    this.gkPunchCd = ui === 2 ? 12 : ui === 1 ? 18 : 26;
                    this.gkPunchT = 8;
                    this.gkAng = Math.atan2(enemy.y - this.y, enemy.x - this.x);
                    this.gkCombo++;
                    enemy.takeDamage((ui === 2 ? 15 : ui === 1 ? 11 : 7) * (this.gkPow ? GK_POW : 1) * (this.gkRage ? 3 : 1), 'other');
                    if (this.gkCombo % 3 === 0) floatingTexts.push(new FloatingText(enemy.x, enemy.y - 24, ui ? 'ORA ORA!' : 'KAIO-KEN PUNCH', ui ? '224, 247, 250' : '255, 183, 77'));
                    playHitSound();
                }
            }
        }

        // Бессмертие Замасу: один раз «умирает» и возрождается с 40% HP в форме Роз
        gbRevive(amount) {
            if (this.type !== 'gblack' || this.gbRevived || amount <= 0 || this.hp - amount > 0) return false;
            this.gbRevived = true;
            this.hp = (this.gbMax || 250) * 0.6;
            this.gbForm = 1; this.gbFlash = 60; this.gbCharge = 0;
            floatingTexts.push(new FloatingText(this.x, this.y - 44, 'IMMORTAL! BLACK REVIVES', '244, 143, 177'));
            playChargeSound(1);
            return true;
        }

        // Гоку Блэк: летит к врагу, удары, энергетическая коса, луч «Божественный суд»;
        // регенерация (бессмертие); при HP < 50% — Супер Сайян Роз (всё сильнее, регенерация быстрее)
        updateGblack(enemy, dist) {
            if (!this.gbMax) this.gbMax = this.hp;
            if (this.gbForm < 1 && this.hp / this.gbMax < 0.5) {
                this.gbForm = 1; this.gbFlash = 50;
                floatingTexts.push(new FloatingText(this.x, this.y - 40, 'SUPER SAIYAN ROSÉ!', '244, 143, 177'));
                playChargeSound(0.8);
            }
            const fm = this.gbForm, m = fm ? 1.8 : 1.3;
            this.hp = Math.min(this.gbMax, this.hp + (fm ? 0.25 : 0.08));   // бессмертное тело
            this.gbPunchCd--; this.gbSlashCd--; this.gbBeamCd--;
            if (this.gbSlashT > 0) this.gbSlashT--;
            if (this.gbFlash > 0) this.gbFlash--;
            if (this.gbBeamT > 0) this.gbBeamT--;
            const valid = enemy && !enemy.out && !enemy.isFakeDead && !enemy.erased;

            if (this.gbCharge > 0) {
                this.dx = 0; this.dy = 0;
                if (valid) this.gbAng = Math.atan2(enemy.y - this.y, enemy.x - this.x);
                this.gbCharge--;
                if (this.gbCharge === 0 && valid) {
                    this.gbBeamT = 16;
                    this.gbAng = Math.atan2(enemy.y - this.y, enemy.x - this.x);
                    enemy.takeDamage(40 * m, 'black_beam');
                    floatingTexts.push(new FloatingText(enemy.x, enemy.y - 26, 'DIVINE JUDGMENT!', fm ? '244, 143, 177' : '206, 147, 216'));
                    playLaserSound(); playExplosionSound();
                }
                return;
            }
            if (valid && this.gbBeamCd <= 0 && dist > 120) {
                this.gbCharge = this.gbChargeMax = 35; this.gbBeamCd = fm ? 140 : 190;
                floatingTexts.push(new FloatingText(this.x, this.y - 34, 'JUSTICE…', '206, 147, 216'));
                playChargeSound(0.5);
                return;
            }
            const spd = 3.9 + fm * 0.8;
            if (valid) {
                const a = Math.atan2(enemy.y - this.y, enemy.x - this.x);
                this.dx = this.dx * 0.82 + Math.cos(a) * spd * 0.18;
                this.dy = this.dy * 0.82 + Math.sin(a) * spd * 0.18;
            } else if (Math.hypot(this.dx, this.dy) < 2) {
                const va = Math.random() * Math.PI * 2;
                this.dx = Math.cos(va) * spd; this.dy = Math.sin(va) * spd;
            }
            this.x += this.dx;
            this.y += this.dy;
            if (valid) {
                const d2 = Math.hypot(enemy.x - this.x, enemy.y - this.y);
                this.gbAng = Math.atan2(enemy.y - this.y, enemy.x - this.x);
                if (d2 < this.radius + enemy.radius + 38 && this.gbSlashCd <= 0) {
                    this.gbSlashCd = fm ? 40 : 60; this.gbSlashT = 12;
                    enemy.takeDamage(20 * m, 'other');
                    floatingTexts.push(new FloatingText(enemy.x, enemy.y - 24, 'ENERGY SCYTHE!', fm ? '244, 143, 177' : '206, 147, 216'));
                    playHitSound();
                } else if (d2 < this.radius + enemy.radius + 12 && this.gbPunchCd <= 0) {
                    this.gbPunchCd = fm ? 14 : 22; this.gbCombo++;
                    enemy.takeDamage(9 * m, 'other');
                    playHitSound();
                }
            }
        }

        // множитель силы Вегеты: база ×1, SSB ×1.4, Ультра Эго ×1.8 и до ×4.5 со стаками
        vgMul() {
            const rv = this.vgRival ? 1.25 : 1;   // «Соперники»: с Гоку в команде сила ещё на 25% выше
            if (this.vgForm === 0) return rv;
            if (this.vgForm === 1) return 1.4 * rv;
            return 1.8 * (1 + 0.05 * this.vgStacks) * rv;
        }

        // Вегета: гордо летит к врагу, бьёт кулаками, Галик Ган; при HP < 60% — Супер Сайян Блю
        // (+ Финальная вспышка), при HP < 30% — Ультра Эго (сила растёт от получаемого урона)
        updateVegeta(enemy, dist) {
            if (!this.vgMax) this.vgMax = this.hp;
            const pct = this.hp / this.vgMax;
            if (this.vgForm < 1 && pct < 0.6) {
                this.vgForm = 1; this.vgFlash = 50;
                floatingTexts.push(new FloatingText(this.x, this.y - 40, 'SUPER SAIYAN BLUE!', '79, 195, 247'));
                playChargeSound(0.8);
            }
            if (this.vgForm === 1 && pct < 0.3) {
                this.vgForm = 2; this.vgFlash = 60;
                floatingTexts.push(new FloatingText(this.x, this.y - 40, 'ULTRA EGO!', '206, 147, 216'));
                playChargeSound(1);
            }
            const gkAlly = balls.some(function (o) { return o.type === 'goku' && !o.out && o !== this && this.isAlly(o); }, this);
            this.vgRival = gkAlly;
            const rv = gkAlly ? 1.25 : 1;
            this.vgPunchCd--; this.vgCd--; this.vgFfCd--;
            if (this.vgPunchT > 0) this.vgPunchT--;
            if (this.vgFlash > 0) this.vgFlash--;
            if (this.vgBeamT > 0) this.vgBeamT--;
            const fm = this.vgForm, mul = this.vgMul();
            const valid = enemy && !enemy.out && !enemy.isFakeDead && !enemy.erased;

            // заряд луча: стоит на месте
            if (this.vgCharge > 0) {
                this.dx = 0; this.dy = 0;
                if (valid) this.vgAng = Math.atan2(enemy.y - this.y, enemy.x - this.x);
                this.vgCharge--;
                if (this.vgCharge === 0 && valid) {
                    const ff = this.vgChargeType === 'final';
                    this.vgBeamT = ff ? 20 : 16; this.vgBeamType = this.vgChargeType;
                    this.vgAng = Math.atan2(enemy.y - this.y, enemy.x - this.x);
                    enemy.takeDamage((ff ? 45 : 26) * mul, ff ? 'vegeta_final' : 'vegeta_galick');
                    floatingTexts.push(new FloatingText(enemy.x, enemy.y - 26, ff ? 'FINAL FLASH!' : 'GALICK GUN!', ff ? '255, 235, 59' : '186, 104, 200'));
                    playLaserSound(); playExplosionSound();
                }
                return;
            }
            if (valid && dist > 120) {
                if (fm >= 1 && this.vgFfCd <= 0) {
                    this.vgChargeType = 'final'; this.vgCharge = this.vgChargeMax = 60; this.vgFfCd = Math.round((fm === 2 ? 240 : 330) / rv);
                    floatingTexts.push(new FloatingText(this.x, this.y - 34, 'FINAL…', '255, 235, 59'));
                    playChargeSound(0.7);
                    return;
                }
                if (this.vgCd <= 0) {
                    this.vgChargeType = 'galick'; this.vgCharge = this.vgChargeMax = 40; this.vgCd = Math.round((fm ? 170 : 230) / rv);
                    floatingTexts.push(new FloatingText(this.x, this.y - 34, 'GA-LICK…', '186, 104, 200'));
                    playChargeSound(0.5);
                    return;
                }
            }
            // полёт к врагу
            const spd = 3.4 + fm * 0.5 + (fm === 2 ? this.vgStacks * 0.02 : 0);
            if (valid) {
                const a = Math.atan2(enemy.y - this.y, enemy.x - this.x);
                this.dx = this.dx * 0.82 + Math.cos(a) * spd * 0.18;
                this.dy = this.dy * 0.82 + Math.sin(a) * spd * 0.18;
            } else if (Math.hypot(this.dx, this.dy) < 2) {
                const va = Math.random() * Math.PI * 2;
                this.dx = Math.cos(va) * spd; this.dy = Math.sin(va) * spd;
            }
            this.x += this.dx;
            this.y += this.dy;
            // серия ударов
            if (valid) {
                const d2 = Math.hypot(enemy.x - this.x, enemy.y - this.y);
                if (d2 < this.radius + enemy.radius + 12 && this.vgPunchCd <= 0) {
                    this.vgPunchCd = fm === 2 ? 14 : fm === 1 ? 20 : 28;
                    this.vgPunchT = 8;
                    this.vgAng = Math.atan2(enemy.y - this.y, enemy.x - this.x);
                    this.vgCombo++;
                    enemy.takeDamage(8 * mul, 'other');
                    if (this.vgCombo % 3 === 0) floatingTexts.push(new FloatingText(enemy.x, enemy.y - 24, fm === 2 ? 'ULTRA EGO ×' + (1 + this.vgStacks) : 'BIG BANG PUNCH', fm === 2 ? '206, 147, 216' : '144, 202, 249'));
                    playHitSound();
                }
            }
        }

        updateTodo(enemy, dist) {
            const yuji = balls.find(function (o) { return o.type === 'yuji' && !o.out && o !== this && this.isAlly(o); }, this);
            this.tdBro = !!yuji;
            this.tdCd--;
            this.tdPunchCd--;
            if (this.tdClapFx > 0) this.tdClapFx--;
            if (this.tdPunchT > 0) this.tdPunchT--;
            if (Math.hypot(this.dx, this.dy) < 3) {
                const va = Math.random() * Math.PI * 2;
                this.dx = Math.cos(va) * 4; this.dy = Math.sin(va) * 4;
            }
            this.x += this.dx;
            this.y += this.dy;
            const clampIn = function (b) {
                b.x = Math.max(b.radius, Math.min(W - b.radius, b.x));
                b.y = Math.max(b.radius, Math.min(H - b.radius, b.y));
            };
            if (enemy && this.tdCd <= 0) {
                this.tdCd = Math.round(150 / (yuji ? 1.25 : 1));   // 150 кадров; с Юджи на 25% быстрее (120)
                this.tdClapFx = 14;
                playChargeSound(0.3);
                if (yuji && Math.random() < 0.5) {
                    // хлопок: Юджи оказывается вплотную к врагу и сразу бьёт
                    const a = Math.random() * Math.PI * 2;
                    const d = yuji.radius + enemy.radius + 4;
                    yuji.x = enemy.x + Math.cos(a) * d; yuji.y = enemy.y + Math.sin(a) * d;
                    clampIn(yuji);
                    yuji.yjCd = 0;
                    floatingTexts.push(new FloatingText(this.x, this.y - 34, 'BOOGIE WOOGIE — BROTHER!', '255, 213, 79'));
                } else {
                    // хлопок: Тодо и враг меняются местами, Тодо сразу бьёт
                    const tx = this.x, ty = this.y;
                    this.x = enemy.x; this.y = enemy.y;
                    enemy.x = tx; enemy.y = ty;
                    clampIn(this); clampIn(enemy);
                    this.tdPunchCd = 0;
                    floatingTexts.push(new FloatingText(this.x, this.y - 34, 'BOOGIE WOOGIE!', '255, 213, 79'));
                }
            }
            if (enemy) {
                const d2 = Math.hypot(enemy.x - this.x, enemy.y - this.y);
                if (d2 < this.radius + enemy.radius + 12 && this.tdPunchCd <= 0) {
                    this.tdPunchCd = 38;
                    this.tdPunchT = 10;
                    this.tdAng = Math.atan2(enemy.y - this.y, enemy.x - this.x);
                    enemy.takeDamage(8, 'other');
                    floatingTexts.push(new FloatingText(enemy.x, enemy.y - 24, 'TODO PUNCH', '215, 204, 200'));
                    playHitSound();
                }
            }
        }

        // Юджи Итадори: бегает за врагом и бьёт кулаками; шанс «Расходящегося кулака» (второй удар с задержкой)
        // и «Чёрной вспышки» (×2.5 урона; после неё следующий удар в «зоне» вспыхивает с шансом 40%)
        updateYuji(enemy, dist) {
            // Юджи после инцидента в Сибуя: серьёзный, сильнее и крепче (130 HP), метки Сукуны на лице.
            // Чёрная вспышка стала частой, а серия из 2 вспышек подряд вводит его в «Зону» (удары ×1.5, быстрее).
            // «Братья»: если рядом в команде Тодо — шанс Чёрной молнии на 25% выше
            const bro = balls.some(function (o) { return o.type === 'todo' && !o.out && o !== this && this.isAlly(o); }, this);
            this.yjBro = bro;
            this.yjCd--;
            if (this.yjPunchT > 0) this.yjPunchT--;
            if (this.yjFlash > 0) this.yjFlash--;
            if (this.yjKoku > 0) this.yjKoku--;
            if (this.yjZone > 0) this.yjZone--;
            else this.yjChain = 0;
            if (this.yjZoneMode > 0) this.yjZoneMode--;
            if (this.yjDelay > 0) {
                this.yjDelay--;
                const tg = this.yjDelayTarget;
                if (this.yjDelay === 0 && tg && !tg.out && !tg.erased) {
                    tg.takeDamage(this.yjDelayDmg, 'other');
                    floatingTexts.push(new FloatingText(tg.x, tg.y - 24, 'DIVERGENT: 2nd IMPACT!', '255, 171, 145'));
                    playExplosionSound();
                }
            }
            // катится: летит прямо и отскакивает от стен
            const spd = this.yjZoneMode > 0 ? 5.4 : 4.8;
            if (Math.hypot(this.dx, this.dy) < spd - 0.9) {
                const va = Math.random() * Math.PI * 2;
                this.dx = Math.cos(va) * spd; this.dy = Math.sin(va) * spd;
            }
            this.x += this.dx;
            this.y += this.dy;
            this.yjRoll = (this.yjRoll || 0) + Math.hypot(this.dx, this.dy) / Math.max(1, this.radius);
            if (enemy && dist < this.radius + enemy.radius + 10 && this.yjCd <= 0) {
                const zm = this.yjZoneMode > 0;
                this.yjCd = zm ? 24 : 34;
                this.yjPunchT = 10;
                this.yjAng = Math.atan2(enemy.y - this.y, enemy.x - this.x);
                let dmg = 7 * (zm ? 1.5 : 1), label = zm ? 'ZONE PUNCH' : 'PUNCH', col = '255, 204, 188', isBF = false;
                // против Сукуны (и Мегуны) Чёрная вспышка — «KOKUSEN», и она на 10% (пункта) вероятнее
                const vsSukuna = enemy.type === 'sukuna' || !!enemy.isMeguna;
                if (Math.random() < ((this.yjZone > 0 ? 0.65 : 0.2) + (vsSukuna ? 0.10 : 0)) * (bro ? 1.25 : 1)) {
                    isBF = true;
                    dmg *= 2.5; label = vsSukuna ? 'KOKUSEN!' : 'BLACK FLASH!'; col = '255, 40, 40';
                    if (vsSukuna) this.yjKoku = 45;
                    this.yjZone = 180; this.yjFlash = 16;
                    this.yjChain++;
                    if (this.yjChain >= 2 && !zm) {
                        this.yjZoneMode = 360;
                        floatingTexts.push(new FloatingText(this.x, this.y - 40, 'THE ZONE', '255, 82, 82'));
                        playChargeSound(0.9);
                    }
                    playExplosionSound();
                } else if (Math.random() < 0.35) {
                    this.yjDelay = 26; this.yjDelayTarget = enemy; this.yjDelayDmg = 12 * (zm ? 1.5 : 1);
                    label = 'DIVERGENT FIST'; col = '255, 171, 145';
                    playHitSound();
                } else {
                    playHitSound();
                }
                // добивающий удар по Сукуне — кат-сцена KO-KU-SEN
                if (vsSukuna && !kokuScene && !raceState && !enemy.isFakeDead && !enemy.isUntouchable() && enemy.hp - dmg <= 0) {
                    startKokuScene(this, enemy);
                    return;
                }
                enemy.takeDamage(dmg, 'other');
                floatingTexts.push(new FloatingText(enemy.x, enemy.y - 24, label + (this.yjChain > 1 && isBF ? ' ×' + this.yjChain : ''), col));
            }
        }

        updateNaoya(enemy, dist) {
            const self = this;
            this.frameRing += 0.12;
            const valid = enemy && !enemy.out && !enemy.isFakeDead && !enemy.erased;

            if (this.naoyaPhase === 'aim') {
                // 24 кадра прицеливания: стоит на месте, линия рывка уже видна
                this.dx = 0;
                this.dy = 0;
                if (!valid) { this.resetNaoya(); return; }
                this.targetAngle = Math.atan2(enemy.y - this.y, enemy.x - this.x);
                this.naoyaTimer++;
                if (this.naoyaTimer >= 24) {
                    this.naoyaPhase = 'dash';
                    this.naoyaTimer = 0;
                    playLaserSound();
                }
            } else if (this.naoyaPhase === 'dash') {
                // рывок «по кадрам»: 12 px за кадр, остаточные образы
                this.naoyaTimer++;
                this.x = Math.max(this.radius, Math.min(W - this.radius, this.x + Math.cos(this.targetAngle) * 12));
                this.y = Math.max(this.radius, Math.min(H - this.radius, this.y + Math.sin(this.targetAngle) * 12));
                if (this.naoyaTimer % 2 === 0) this.afterimages.push({ x: this.x, y: this.y, life: 14 });
                const victim = this.targets().find(function (t) {
                    return Math.hypot(t.x - self.x, t.y - self.y) <= self.radius + t.radius + 2;
                });
                if (victim) {
                    this.naoyaStrike(victim);
                } else if (this.naoyaTimer >= 36) {
                    this.naoyaPhase = '';
                    this.naoyaCd = 80;
                    this.randomizeVelocity();
                }
            } else if (this.naoyaPhase === 'combo') {
                // серия из трёх ударов по замороженной цели
                this.dx = 0;
                this.dy = 0;
                const t = this.naoyaTarget;
                if (!t || t.out || t.erased || t.isFakeDead ||
                    Math.hypot(t.x - this.x, t.y - this.y) > this.radius + t.radius + 30) {
                    this.resetNaoya();
                    return;
                }
                t.stunTimer = Math.max(t.stunTimer, 3);
                this.naoyaTimer++;
                if (this.naoyaTimer === 10 || this.naoyaTimer === 24 || this.naoyaTimer === 38) {
                    t.takeDamage(6, 'naoya');
                    playHitSound();
                    floatingTexts.push(new FloatingText(t.x, t.y - 22, 'FRAME ' + (this.naoyaTimer === 10 ? 1 : (this.naoyaTimer === 24 ? 2 : 3)), '255, 224, 130'));
                }
                if (this.naoyaTimer >= 52) {
                    if (t.stunTimer <= 3) t.stunTimer = 0;
                    this.naoyaPhase = '';
                    this.naoyaTimer = 0;
                    this.naoyaTarget = null;
                    this.naoyaCd = 0;
                    this.randomizeVelocity();
                }
            } else {
                // быстрое «порхание» + подготовка рывка
                this.x += this.dx * 1.35;
                this.y += this.dy * 1.35;
                if (this.frameRing % 0.6 < 0.12) this.afterimages.push({ x: this.x, y: this.y, life: 8 });
                this.naoyaCd++;
                if (this.naoyaCd >= 200 && valid) {
                    this.naoyaPhase = 'aim';
                    this.naoyaTimer = 0;
                    this.naoyaCd = 0;
                    floatingTexts.push(new FloatingText(this.x, this.y - 34, 'PROJECTION: 24 FRAMES', '255, 224, 130'));
                    playChargeSound(0.4);
                }
            }
        }

        /* ---------- Prism Ball ---------- */
        resetPrism() {
            this.beamOn = false;
            this.beamTimer = 0;
            this.energy = 0;
            this.focusPhase = '';
            this.focusTimer = 0;
            this.focusCooldown = 0;
            this.focusTarget = null;
            this.heat = 0;
            this.holos = [];
        }

        endFocus() {
            this.focusPhase = '';
            this.focusTimer = 0;
            this.focusCooldown = 0;
            this.focusTarget = null;
            this.heat = 0;
            this.holos = [];
            this.randomizeVelocity();
        }

        startFocus() {
            this.focusPhase = 'holo';
            this.focusTimer = 0;
            this.heat = 0;
            this.holos = [];
            for (let i = 0; i < 10; i++) {
                const a = i * Math.PI * 2 / 10;
                this.holos.push({ x: this.x, y: this.y, dx: Math.cos(a) * 3, dy: Math.sin(a) * 3, life: 60, rot: Math.random() * 6 });
            }
            floatingTexts.push(new FloatingText(this.x, this.y - 32, 'FOCUS', '0, 240, 255'));
            playTimeStopSound();
        }

        pickFocusTarget() {
            let best = null, bd = Infinity;
            const self = this;
            this.targets().forEach(function (o) {
                const d = Math.hypot(o.x - self.x, o.y - self.y);
                if (d < bd) { bd = d; best = o; }
            });
            return best;
        }

        updatePrism(enemy, dist) {
            const self = this;
            this.lensAngle += 0.07;

            // «снайпер»: держит дистанцию и кружит к центру арены.
            // Активного Анти-Шара обходит по большему радиусу.
            const moveStep = function (factor) {
                let kite = enemy, kiteR = 210;
                const ab = balls.find(function (o) {
                    return o !== self && !o.out && o.type === 'antiball' && o.antiActive;
                });
                if (ab) { kite = ab; kiteR = 280; }
                const kd = kite ? Math.hypot(kite.x - self.x, kite.y - self.y) : 9999;
                const sp = 2.6 * factor;
                if (kite && kd < kiteR) {
                    let ax = self.x - kite.x, ay = self.y - kite.y;
                    const al = Math.hypot(ax, ay) || 1;
                    ax /= al; ay /= al;
                    let px = -ay, py = ax;
                    if (px * (W / 2 - self.x) + py * (H / 2 - self.y) < 0) { px = -px; py = -py; }
                    const vx = ax * 0.6 + px * 0.8, vy = ay * 0.6 + py * 0.8;
                    const vl = Math.hypot(vx, vy) || 1;
                    self.dx = vx / vl * sp * 1.15;
                    self.dy = vy / vl * sp * 1.15;
                } else {
                    const dl = Math.hypot(self.dx, self.dy) || 1;
                    self.dx = self.dx / dl * sp;
                    self.dy = self.dy / dl * sp;
                }
                self.x += self.dx;
                self.y += self.dy;
            };

            // ----- активная способность «Фокусировка / Тепловой удар» -----
            if (this.focusPhase) {
                this.dx = 0;
                this.dy = 0;
                this.focusTimer++;

                this.holos.forEach(function (h) { h.x += h.dx; h.y += h.dy; h.life--; h.rot += 0.15; });
                this.holos = this.holos.filter(function (h) { return h.life > 0; });

                if (this.focusPhase === 'holo') {
                    // голограммы разлетаются и сбивают врагов с толку
                    this.targets().forEach(function (t) {
                        t.disorientTimer = 15;
                        const busy = t.isUsingAbility || t.isCharging || t.isOneShotCharging || t.isAuthorCharging ||
                            t.beamOn || t.focusPhase || t.stunTimer > 0 || t.comboHitsLeft > 0 ||
                            t.strikeTimer > 0 || t.isRaging;
                        if (!busy && self.focusTimer % 12 === 0) t.randomizeVelocity();
                    });
                    if (this.focusTimer >= 60) { this.focusPhase = 'charge'; this.focusTimer = 0; }

                } else if (this.focusPhase === 'charge') {
                    const tg = this.pickFocusTarget();
                    if (!tg) { this.endFocus(); return; }
                    this.targetAngle = Math.atan2(tg.y - this.y, tg.x - this.x);
                    if (this.focusTimer >= 30) {
                        this.focusPhase = 'beam';
                        this.focusTimer = 0;
                        this.heat = 0;
                        this.focusTarget = tg;
                        playLaserSound();
                    }

                } else if (this.focusPhase === 'beam') {
                    let tg = this.focusTarget;
                    if (!tg || tg.out || tg.erased || tg.isFakeDead) tg = this.focusTarget = this.pickFocusTarget();
                    if (!tg) { this.endFocus(); return; }

                    // плавный разворот на цель
                    const want = Math.atan2(tg.y - this.y, tg.x - this.x);
                    let diff = want - this.targetAngle;
                    while (diff > Math.PI) diff -= Math.PI * 2;
                    while (diff < -Math.PI) diff += Math.PI * 2;
                    this.targetAngle += Math.max(-0.09, Math.min(0.09, diff));

                    // луч жжёт всех, кого заденет
                    let onTarget = false;
                    this.targets().forEach(function (t) {
                        if (self.laserHits(t, 520, 12)) {
                            t.dot(0.2);
                            if (t === tg) onTarget = true;
                        }
                    });
                    if (onTarget) this.heat++; else this.heat = Math.max(0, this.heat - 2);

                    if (this.heat >= 120) {
                        // удержал луч > 2 секунд: критический урон + отбрасывание
                        const ang = Math.atan2(tg.y - this.y, tg.x - this.x);
                        tg.takeDamage(25);
                        tg.kbx = Math.cos(ang) * 14;
                        tg.kby = Math.sin(ang) * 14;
                        tg.kbTimer = 25;
                        tg.stunTimer = Math.max(tg.stunTimer, 50);
                        floatingTexts.push(new FloatingText(tg.x, tg.y - 34, 'CRIT!', '0, 240, 255'));
                        playExplosionSound();
                        this.endFocus();
                    } else if (this.focusTimer >= 220) {
                        this.endFocus();
                    }
                }
                return;
            }

            // ----- пассивка «Перезарядка линзы» -----
            if (!this.beamOn) {
                this.energy = Math.min(100, this.energy + 100 / 240);
                moveStep(1);
                this.focusCooldown++;
                if (this.focusCooldown >= 420 && this.targets().length > 0) {
                    this.startFocus();
                } else if (this.energy >= 100 && this.targets().length > 0) {
                    this.beamOn = true;
                    this.beamTimer = 0;
                    playLaserSound();
                    floatingTexts.push(new FloatingText(this.x, this.y - 32, 'LENS CHARGED', '0, 240, 255'));
                }
            } else {
                // шкала полна: чуть медленнее, зато тонкий дальний луч без задержки
                moveStep(0.75);
                this.beamTimer++;
                this.energy -= 100 / 150;
                if (enemy) this.targetAngle = Math.atan2(enemy.y - this.y, enemy.x - this.x);
                this.targets().forEach(function (t) {
                    if (self.laserHits(t, 320, 7)) t.dot(0.22, 'prism');
                });
                if (this.energy <= 0 || this.beamTimer >= 150) {
                    this.energy = 0;
                    this.beamOn = false;
                    this.beamTimer = 0;
                }
            }
        }

        // луч ульты: Красный — чёрный луч, красная оболочка, оранжевая середина;
        //            Синий — белый луч, синяя оболочка, голубая середина
        drawUltBeam() {
            const ex = this.x + Math.cos(this.targetAngle) * ULT_LEN;
            const ey = this.y + Math.sin(this.targetAngle) * ULT_LEN;
            const pulse = 1 + 0.07 * Math.sin(this.abilityTimer * 0.7);
            const w = ULT_WIDTH * pulse;
            const layers = this.type === 'red'
                ? [[w, 'rgba(255, 30, 30, 0.62)'], [w * 0.64, 'rgba(255, 152, 0, 0.93)'], [w * 0.26, '#000000']]
                : [[w, 'rgba(33, 120, 255, 0.62)'], [w * 0.64, 'rgba(120, 210, 255, 0.95)'], [w * 0.26, '#ffffff']];
            const self = this;
            layers.forEach(function (l) {
                ctx.beginPath();
                ctx.moveTo(self.x, self.y);
                ctx.lineTo(ex, ey);
                ctx.strokeStyle = l[1];
                ctx.lineWidth = l[0];
                ctx.stroke();
            });
        }

        drawPrismEffects() {
            const self = this;
            // зеркальные голограммы
            this.holos.forEach(function (h) {
                ctx.save();
                ctx.translate(h.x, h.y);
                ctx.rotate(h.rot);
                ctx.globalAlpha = Math.max(0, h.life / 60) * 0.85;
                ctx.beginPath();
                ctx.moveTo(0, -9);
                ctx.lineTo(6, 0);
                ctx.lineTo(0, 9);
                ctx.lineTo(-6, 0);
                ctx.closePath();
                ctx.fillStyle = 'rgba(190, 255, 255, 0.45)';
                ctx.fill();
                ctx.strokeStyle = '#00f0ff';
                ctx.lineWidth = 1.5;
                ctx.stroke();
                ctx.restore();
            });
            ctx.globalAlpha = 1;

            const drawBeam = function (len, w) {
                const ex = self.x + Math.cos(self.targetAngle) * len;
                const ey = self.y + Math.sin(self.targetAngle) * len;
                ctx.lineCap = 'round';
                ctx.beginPath();
                ctx.moveTo(self.x, self.y);
                ctx.lineTo(ex, ey);
                ctx.strokeStyle = 'rgba(0, 240, 255, 0.35)';
                ctx.lineWidth = w * 2.2;
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(self.x, self.y);
                ctx.lineTo(ex, ey);
                ctx.strokeStyle = 'rgba(225, 255, 255, 0.95)';
                ctx.lineWidth = w * 0.7;
                ctx.stroke();
                ctx.lineCap = 'butt';
            };

            if (this.beamOn) drawBeam(320, 8);

            if (this.focusPhase === 'charge') {
                const p = this.focusTimer / 30;
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.radius + (1 - p) * 30, 0, Math.PI * 2);
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
                ctx.lineWidth = 3;
                ctx.stroke();
            }
            if (this.focusPhase === 'beam') {
                drawBeam(520, 14 + Math.min(1, this.heat / 120) * 8);
                // шкала нагрева цели
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.radius + 8, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, this.heat / 120));
                ctx.strokeStyle = '#ff9800';
                ctx.lineWidth = 4;
                ctx.stroke();
            }
        }

        drawPrismBody() {
            const hue = 180 + 20 * Math.sin(this.lensAngle * 0.8);
            const g = ctx.createLinearGradient(this.x - 20, this.y - 20, this.x + 20, this.y + 20);
            g.addColorStop(0, 'hsl(' + hue + ', 100%, 62%)');
            g.addColorStop(0.5, '#00f0ff');
            g.addColorStop(1, 'hsl(' + (hue + 45) + ', 100%, 58%)');
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
            ctx.fillStyle = g;
            ctx.fill();

            // стальная окантовка
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
            ctx.strokeStyle = '#b0bec5';
            ctx.lineWidth = 3;
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius - 3, 0, Math.PI * 2);
            ctx.strokeStyle = '#607d8b';
            ctx.lineWidth = 1;
            ctx.stroke();

            // вращающаяся кристаллическая линза
            ctx.save();
            ctx.translate(this.x, this.y);
            ctx.rotate(this.lensAngle);
            ctx.beginPath();
            for (let i = 0; i < 6; i++) {
                const a = i * Math.PI / 3;
                const px = Math.cos(a) * 9, py = Math.sin(a) * 9;
                if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
            }
            ctx.closePath();
            ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
            ctx.fill();
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
            ctx.lineWidth = 1.5;
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(-9, 0); ctx.lineTo(9, 0);
            ctx.moveTo(-4.5, -7.8); ctx.lineTo(4.5, 7.8);
            ctx.moveTo(4.5, -7.8); ctx.lineTo(-4.5, 7.8);
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
            ctx.lineWidth = 1;
            ctx.stroke();
            ctx.restore();

            // шкала энергии линзы
            const bw = 36;
            ctx.fillStyle = '#000';
            ctx.fillRect(this.x - bw / 2, this.y + this.radius + 7, bw, 4);
            ctx.fillStyle = this.beamOn ? '#ffffff' : '#00f0ff';
            ctx.fillRect(this.x - bw / 2, this.y + this.radius + 7, bw * Math.max(0, Math.min(1, this.energy / 100)), 4);
        }

        // len — длина луча, hw — половина ширины луча
        laserHits(enemy, len, hw) {
            len = len || 150;
            hw = (hw === undefined) ? 17 : hw;
            const ex = this.x + Math.cos(this.targetAngle) * len;
            const ey = this.y + Math.sin(this.targetAngle) * len;
            const vx = ex - this.x, vy = ey - this.y;
            const wx = enemy.x - this.x, wy = enemy.y - this.y;
            let t = (wx * vx + wy * vy) / (vx * vx + vy * vy);
            t = Math.max(0, Math.min(1, t));
            const px = this.x + vx * t, py = this.y + vy * t;
            return Math.hypot(enemy.x - px, enemy.y - py) <= enemy.radius + hw;
        }

        draw() {
            if (this.out) return;
            if (this.erased) {
                if (this.eraseTimer > 0) {
                    const k = this.eraseTimer / 45;
                    ctx.globalAlpha = k;
                    ctx.beginPath();
                    ctx.arc(this.x, this.y, this.radius * k, 0, Math.PI * 2);
                    ctx.fillStyle = this.color;
                    ctx.fill();
                    ctx.fillStyle = 'white';
                    for (let i = 0; i < 10; i++) {
                        const a = i * Math.PI / 5;
                        const r = (1 - k) * 45;
                        ctx.fillRect(this.x + Math.cos(a) * r - 2, this.y + Math.sin(a) * r - 2, 4, 4);
                    }
                    ctx.globalAlpha = 1;
                }
                return;
            }

            if (this.isFakeDead) {
                ctx.globalAlpha = 0.35;
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
                ctx.fillStyle = '#888';
                ctx.fill();
                ctx.globalAlpha = 1;
                ctx.fillStyle = 'white';
                ctx.font = '14px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText('✖', this.x, this.y + 5);
                return;
            }

            const charging = this.isCharging || this.isOneShotCharging || this.isAuthorCharging;
            if (charging) {
                const t = this.isAuthorCharging ? this.authorChargeTimer
                        : (this.isOneShotCharging ? this.oneShotChargeTimer : this.chargeTimer);
                const ultCharge = this.isCharging && this.isUlt;
                const progress = t / (this.isAuthorCharging ? this.authorChargeMax : (ultCharge ? ULT_CHARGE : 90));
                const ringRadius = this.radius + (1 - progress) * 25;
                ctx.beginPath();
                ctx.arc(this.x, this.y, ringRadius, 0, Math.PI * 2);
                ctx.strokeStyle = this.type === 'author' ? (this.skill === 'erase' ? 'rgba(255, 255, 255, 1)' : 'rgba(255, 179, 0, 0.9)')
                    : (this.type === 'oneshot' ? 'rgba(255, 0, 0, 0.9)'
                    : (this.type === 'blue' ? 'rgba(0, 255, 255, 0.8)' : 'rgba(255, 153, 0, 0.8)'));
                if (ultCharge) ctx.strokeStyle = this.type === 'blue' ? 'rgba(80, 170, 255, 0.95)' : 'rgba(255, 40, 40, 0.95)';
                ctx.lineWidth = ultCharge ? 6 : 3;
                ctx.stroke();
                ctx.closePath();
            }

            const authorLaser = this.type === 'author' && this.skill === 'laser' && this.skillPhase === 'active';
            if (this.isUsingAbility && this.isUlt && (this.type === 'blue' || this.type === 'red')) this.drawUltBeam();
            if ((this.isUsingAbility && !this.isUlt && (this.type === 'blue' || this.type === 'red')) || authorLaser) {
                const laserLength = 150;
                const endX = this.x + Math.cos(this.targetAngle) * laserLength;
                const endY = this.y + Math.sin(this.targetAngle) * laserLength;
                ctx.beginPath();
                ctx.moveTo(this.x, this.y);
                ctx.lineTo(endX, endY);
                ctx.strokeStyle = this.type === 'author' ? 'rgba(255, 215, 0, 0.7)'
                    : (this.type === 'blue' ? 'rgba(0, 255, 255, 0.7)' : 'rgba(255, 153, 0, 0.7)');
                ctx.lineWidth = 35;
                ctx.stroke();
                ctx.closePath();
            }

            if (this.type === 'thefirstblueguy') {
                // голубое тело, белая оболочка и ярко-голубой центр
                ctx.beginPath(); ctx.arc(this.x, this.y, this.radius + 5, 0, Math.PI * 2);
                ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 5; ctx.stroke();
                ctx.beginPath(); ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
                ctx.fillStyle = '#0755b8'; ctx.fill();
                ctx.beginPath(); ctx.arc(this.x, this.y, 9, 0, Math.PI * 2);
                ctx.fillStyle = '#00c8ff'; ctx.shadowColor = '#00c8ff'; ctx.shadowBlur = 14; ctx.fill(); ctx.shadowBlur = 0;
                if (this.playerLaserOn) {
                    ctx.beginPath(); ctx.moveTo(this.x, this.y);
                    ctx.lineTo(this.x + Math.cos(this.targetAngle) * 500, this.y + Math.sin(this.targetAngle) * 500);
                    ctx.strokeStyle = 'rgba(0,80,210,.95)'; ctx.lineWidth = 38; ctx.stroke();
                    ctx.beginPath(); ctx.moveTo(this.x, this.y);
                    ctx.lineTo(this.x + Math.cos(this.targetAngle) * 500, this.y + Math.sin(this.targetAngle) * 500);
                    ctx.strokeStyle = 'rgba(255,255,255,.98)'; ctx.lineWidth = 18; ctx.stroke();
                    ctx.beginPath(); ctx.moveTo(this.x, this.y);
                    ctx.lineTo(this.x + Math.cos(this.targetAngle) * 500, this.y + Math.sin(this.targetAngle) * 500);
                    ctx.strokeStyle = 'rgba(0,195,255,1)'; ctx.lineWidth = 7; ctx.stroke();
                }
            }
            if (this.type === 'blackflash') {
                // Чёрный костюм, красно-малиновая молния и шлейф Силы Скорости
                this.bfTrail.forEach(p => {
                    ctx.globalAlpha = p.life / 16 * 0.55;
                    ctx.beginPath(); ctx.arc(p.x,p.y,this.radius*0.72,0,Math.PI*2);
                    ctx.fillStyle = '#8b001f'; ctx.fill();
                });
                ctx.globalAlpha = 1;
                ctx.save();
                ctx.shadowColor = '#ff1744'; ctx.shadowBlur = 18;
                ctx.beginPath(); ctx.arc(this.x,this.y,this.radius+4,0,Math.PI*2);
                ctx.strokeStyle = '#ff1744'; ctx.lineWidth = 3; ctx.stroke();
                ctx.shadowBlur = 0;
                ctx.beginPath(); ctx.arc(this.x,this.y,this.radius,0,Math.PI*2);
                ctx.fillStyle = '#09070a'; ctx.fill();
                // красные глаза и белая маска-череп
                ctx.fillStyle = '#f5e8eb';
                ctx.beginPath(); ctx.ellipse(this.x,this.y+2,10,12,0,0,Math.PI*2); ctx.fill();
                ctx.fillStyle = '#ff1744';
                ctx.beginPath(); ctx.moveTo(this.x-8,this.y-3); ctx.lineTo(this.x-2,this.y-1); ctx.lineTo(this.x-8,this.y+2); ctx.fill();
                ctx.beginPath(); ctx.moveTo(this.x+8,this.y-3); ctx.lineTo(this.x+2,this.y-1); ctx.lineTo(this.x+8,this.y+2); ctx.fill();
                ctx.strokeStyle = '#3a0715'; ctx.lineWidth = 2;
                ctx.beginPath(); ctx.moveTo(this.x-5,this.y+9); ctx.lineTo(this.x+5,this.y+9); ctx.stroke();
                // молнии по краям шара
                for (let side of [-1,1]) {
                    ctx.beginPath(); ctx.moveTo(this.x+side*15,this.y-12);
                    ctx.lineTo(this.x+side*23,this.y-3); ctx.lineTo(this.x+side*16,this.y+2);
                    ctx.lineTo(this.x+side*25,this.y+12);
                    ctx.strokeStyle = '#ff1744'; ctx.lineWidth = 2.5; ctx.stroke();
                }
                ctx.restore();
            }
            if (this.type === 'prism') this.drawPrismEffects();

            if (this.type === 'green' || this.type === 'author') {
                ctx.beginPath();
                ctx.arc(this.x, this.y, 50, 0, Math.PI * 2);
                ctx.strokeStyle = 'rgba(76, 175, 80, 0.2)';
                ctx.lineWidth = 1;
                ctx.stroke();
                ctx.closePath();
            }

            if ((this.type === 'antiball' || this.type === 'author') && this.antiActive) {
                const rgb = this.type === 'author' ? '255, 215, 0' : '156, 39, 176';
                const enemy = this.nearestEnemy();
                if (enemy && (enemy.type === 'blue' || enemy.type === 'red' || enemy.type === 'prism')) {
                    const angle = Math.atan2(enemy.y - this.y, enemy.x - this.x);
                    const reach = (enemy.type === 'prism' || enemy.isUlt) ? 260 : 150;
                    ctx.beginPath();
                    ctx.moveTo(this.x, this.y);
                    ctx.lineTo(this.x + Math.cos(angle) * reach, this.y + Math.sin(angle) * reach);
                    ctx.strokeStyle = 'rgba(' + rgb + ', 0.8)';
                    ctx.lineWidth = 35;
                    ctx.stroke();
                    ctx.closePath();
                } else {
                    ctx.beginPath();
                    ctx.arc(this.x, this.y, 80, 0, Math.PI * 2);
                    ctx.fillStyle = 'rgba(' + rgb + ', 0.2)';
                    ctx.fill();
                    ctx.strokeStyle = this.type === 'author' ? '#ffe082' : '#ce93d8';
                    ctx.lineWidth = 2;
                    ctx.stroke();
                    ctx.closePath();
                }
            }

            // тень на месте, откуда исчез (One Shot / Автор)
            if (this.ghostTimer > 0) {
                ctx.globalAlpha = this.ghostTimer / 25;
                ctx.beginPath();
                ctx.arc(this.ghostX, this.ghostY, this.radius, 0, Math.PI * 2);
                ctx.fillStyle = this.type === 'author' ? '#ffea00' : '#ff3333';
                ctx.fill();
                ctx.globalAlpha = 1;
            }
            // замах перед ударом в спину
            if (this.strikeTimer > 0) {
                const target = this.nearestEnemy();
                if (target) {
                    ctx.beginPath();
                    ctx.moveTo(this.x, this.y);
                    ctx.lineTo(target.x, target.y);
                    ctx.strokeStyle = this.type === 'author' ? 'rgba(255, 234, 0, 0.9)' : 'rgba(255, 50, 50, 0.9)';
                    ctx.lineWidth = 4;
                    ctx.stroke();
                    ctx.closePath();
                }
            }
            if (this.type === 'oneshot') {
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.radius + 4, 0, Math.PI * 2);
                ctx.strokeStyle = this.strikeTimer > 0 ? '#ffffff' : '#ff3333';
                ctx.lineWidth = 2;
                ctx.stroke();
                ctx.closePath();
            }

            if ((this.type === 'scp096' || this.type === 'author') && this.isRaging) {
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.radius + 6, 0, Math.PI * 2);
                ctx.strokeStyle = 'rgba(255, 0, 0, 0.8)';
                ctx.lineWidth = 3;
                ctx.stroke();
                ctx.closePath();
            }

            if (this.type === 'author') {
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.radius + 6, 0, Math.PI * 2);
                ctx.strokeStyle = '#ffea00';
                ctx.lineWidth = 3;
                ctx.stroke();
                ctx.closePath();
            }

            // Годжо — голубое свечение
            if (this.type === 'gojo') {
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.radius + 8, 0, Math.PI * 2);
                ctx.strokeStyle = 'rgba(144, 202, 249, 0.7)';
                ctx.lineWidth = 3;
                ctx.stroke();
                ctx.closePath();
            }
            // Сукуна / Мегуна
            if (this.type === 'sukuna') {
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.radius + 6, 0, Math.PI * 2);
                ctx.strokeStyle = this.isMeguna ? 'rgba(255, 64, 129, 0.9)' : 'rgba(255, 80, 80, 0.85)';
                ctx.lineWidth = this.isMeguna ? 3 : 2;
                ctx.stroke();
                ctx.closePath();
            }
            // Муха 1 — салатовое свечение + крылья
            if (this.type === 'muha1') {
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.radius + 6, 0, Math.PI * 2);
                ctx.strokeStyle = 'rgba(178, 255, 89, 0.85)';
                ctx.lineWidth = 2;
                ctx.stroke();
                ctx.closePath();
                const wf = Math.sin(Date.now() / 45) * 0.35;
                ctx.fillStyle = 'rgba(220, 255, 220, 0.55)';
                [-1, 1].forEach(function (sd) {
                    ctx.beginPath();
                    ctx.ellipse(this.x + sd * (this.radius * 0.7), this.y - this.radius * 0.6, this.radius * 0.5, this.radius * (0.9 + wf), sd * 0.5, 0, Math.PI * 2);
                    ctx.fill();
                }, this);
            }
            // Муха 2 — зелёное свечение
            if (this.type === 'muha2') {
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.radius + 6, 0, Math.PI * 2);
                ctx.strokeStyle = 'rgba(105, 240, 174, 0.8)';
                ctx.lineWidth = 2;
                ctx.stroke();
                ctx.closePath();
            }
            // Мегуми — тёмное кольцо
            if (this.type === 'megumi') {
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.radius + 5, 0, Math.PI * 2);
                ctx.strokeStyle = 'rgba(176, 190, 197, 0.7)';
                ctx.lineWidth = 2;
                ctx.stroke();
                ctx.closePath();
            }
            // Рю
            if (this.type === 'ryu') {
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.radius + 5, 0, Math.PI * 2);
                ctx.strokeStyle = 'rgba(255, 204, 128, 0.85)';
                ctx.lineWidth = 2;
                ctx.stroke();
                if (this.graniteBeam) {
                    const len = 280;
                    const ex = this.x + Math.cos(this.targetAngle) * len;
                    const ey = this.y + Math.sin(this.targetAngle) * len;
                    ctx.lineCap = 'round';
                    ctx.beginPath();
                    ctx.moveTo(this.x, this.y);
                    ctx.lineTo(ex, ey);
                    ctx.strokeStyle = 'rgba(255, 183, 77, 0.45)';
                    ctx.lineWidth = 42;
                    ctx.stroke();
                    ctx.beginPath();
                    ctx.moveTo(this.x, this.y);
                    ctx.lineTo(ex, ey);
                    ctx.strokeStyle = 'rgba(255, 236, 179, 0.95)';
                    ctx.lineWidth = 16;
                    ctx.stroke();
                    ctx.lineCap = 'butt';
                }
            }
            // Юта
            if (this.type === 'yuta') {
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.radius + 5, 0, Math.PI * 2);
                ctx.strokeStyle = 'rgba(255, 105, 190, 0.9)';
                ctx.lineWidth = 2;
                ctx.stroke();
                if (this.copiedSkill) {
                    ctx.fillStyle = 'rgba(144, 164, 255, 0.9)';
                    ctx.font = '10px sans-serif';
                    ctx.textAlign = 'center';
                    ctx.fillText('copy: ' + this.copiedSkill, this.x, this.y + this.radius + 16);
                }
                if (this.yutaBeam) {
                    const len = 260;
                    // слегка искривлённый луч (несколько сегментов)
                    ctx.lineCap = 'round';
                    let px = this.x, py = this.y;
                    const segs = 8;
                    for (let s = 1; s <= segs; s++) {
                        const t = s / segs;
                        const wobble = Math.sin(this.yutaBeamTimer * 0.3 + s) * 10 * (this.beamPower < 0.9 ? 1.4 : 0.6);
                        const ang = this.targetAngle + wobble * 0.01;
                        const nx = this.x + Math.cos(ang) * len * t + Math.cos(ang + Math.PI / 2) * wobble * 0.3;
                        const ny = this.y + Math.sin(ang) * len * t + Math.sin(ang + Math.PI / 2) * wobble * 0.3;
                        ctx.beginPath();
                        ctx.moveTo(px, py);
                        ctx.lineTo(nx, ny);
                        ctx.strokeStyle = 'rgba(255, 70, 190, 0.48)';
                        ctx.lineWidth = 34;
                        ctx.stroke();
                        ctx.beginPath();
                        ctx.moveTo(px, py);
                        ctx.lineTo(nx, ny);
                        ctx.strokeStyle = 'rgba(255, 190, 235, 0.98)';
                        ctx.lineWidth = 18;
                        ctx.stroke();
                        ctx.beginPath();
                        ctx.moveTo(px, py);
                        ctx.lineTo(nx, ny);
                        ctx.strokeStyle = 'rgba(255, 45, 170, 1)';
                        ctx.lineWidth = 7;
                        ctx.stroke();
                        px = nx; py = ny;
                    }
                    ctx.lineCap = 'butt';
                }
            }
            // Юта: катана и Рика (ульта)
            if (this.type === 'yuta') {
                if (this.yUltT > 0) {
                    const pulse = 0.75 + Math.sin(Date.now() / 120) * 0.12;
                    ctx.globalAlpha = 0.28 * pulse;
                    ctx.fillStyle = '#f8bbd0';
                    ctx.beginPath(); ctx.arc(this.x + this.radius * 1.2, this.y - this.radius * 1.6, this.radius * 2.4, 0, Math.PI * 2); ctx.fill();
                    ctx.globalAlpha = 0.6 * pulse;
                    ctx.fillStyle = '#1a1a1a';
                    ctx.beginPath(); ctx.arc(this.x + this.radius * 0.6, this.y - this.radius * 2.0, 3.5, 0, Math.PI * 2); ctx.fill();
                    ctx.beginPath(); ctx.arc(this.x + this.radius * 1.8, this.y - this.radius * 2.0, 3.5, 0, Math.PI * 2); ctx.fill();
                    ctx.fillRect(this.x + this.radius * 0.7, this.y - this.radius * 1.2, this.radius * 1.0, 3);
                    ctx.globalAlpha = 1;
                    ctx.beginPath(); ctx.arc(this.x, this.y, this.radius + 9, 0, Math.PI * 2);
                    ctx.strokeStyle = 'rgba(255, 105, 190, ' + (0.5 + 0.3 * pulse) + ')'; ctx.lineWidth = 3; ctx.stroke();
                    ctx.fillStyle = 'rgba(255, 105, 190, 0.95)'; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center';
                    ctx.fillText('RIKA', this.x, this.y - this.radius - 14);
                }
                // катана
                const idle = Math.atan2(this.dy, this.dx) + 0.7;
                const swinging = this.ySwingT > 0;
                const ang = swinging ? this.ySwingAng - 1.1 + 2.2 * (1 - this.ySwingT / 14) : idle;
                const bl = swinging ? 40 : 26;
                if (swinging) {
                    ctx.beginPath();
                    ctx.arc(this.x, this.y, this.radius + bl * 0.8, this.ySwingAng - 1.1, ang);
                    ctx.strokeStyle = 'rgba(210, 235, 255, 0.85)'; ctx.lineWidth = 5; ctx.stroke();
                }
                ctx.lineCap = 'round';
                ctx.beginPath();
                ctx.moveTo(this.x + Math.cos(ang) * (this.radius - 2), this.y + Math.sin(ang) * (this.radius - 2));
                ctx.lineTo(this.x + Math.cos(ang) * (this.radius + bl), this.y + Math.sin(ang) * (this.radius + bl));
                ctx.strokeStyle = '#eceff1'; ctx.lineWidth = 3; ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(this.x + Math.cos(ang) * (this.radius - 2), this.y + Math.sin(ang) * (this.radius - 2));
                ctx.lineTo(this.x + Math.cos(ang) * (this.radius + 5), this.y + Math.sin(ang) * (this.radius + 5));
                ctx.strokeStyle = '#5d4037'; ctx.lineWidth = 4; ctx.stroke();
                ctx.lineCap = 'butt';
            }
            // Гоку Блэк: чёрная одежда, серьга потара, коса, луч; в Роз — розовые волосы
            if (this.type === 'gblack') {
                const fm = this.gbForm, R = this.radius;
                const hair = fm ? '#f48fb1' : '#141414';
                const pulse = Math.sin(Date.now() / 90) * 2;
                ctx.beginPath(); ctx.arc(this.x, this.y, R + 7 + pulse + fm * 3, 0, Math.PI * 2);
                ctx.fillStyle = fm ? 'rgba(244, 143, 177, 0.28)' : 'rgba(120, 60, 160, 0.20)'; ctx.fill();
                ctx.strokeStyle = fm ? 'rgba(248, 187, 208, 0.95)' : 'rgba(171, 71, 188, 0.8)'; ctx.lineWidth = 2.5; ctx.stroke();
                ctx.fillStyle = hair;
                for (let k = -2; k <= 2; k++) {
                    const hx = this.x + k * R * 0.4;
                    ctx.beginPath();
                    ctx.moveTo(hx - 5, this.y - R * 0.75);
                    ctx.lineTo(hx + k * 4, this.y - R - 12 + Math.abs(k) * 3);
                    ctx.lineTo(hx + 5, this.y - R * 0.75);
                    ctx.fill();
                    ctx.strokeStyle = fm ? '#fce4ec' : '#9e9e9e'; ctx.lineWidth = 1.5; ctx.stroke();
                }
                // светлый пояс, серьга потара (зелёная), красные глаза
                ctx.fillStyle = '#f5f5f5'; ctx.fillRect(this.x - R * 0.8, this.y + R * 0.2, R * 1.6, 4);
                ctx.beginPath(); ctx.arc(this.x + R * 0.95, this.y + R * 0.1, 3.2, 0, Math.PI * 2); ctx.fillStyle = '#66bb6a'; ctx.fill();
                ctx.fillStyle = '#ff1744';
                ctx.beginPath(); ctx.arc(this.x - R * 0.32, this.y - R * 0.15, 2.4, 0, Math.PI * 2); ctx.arc(this.x + R * 0.32, this.y - R * 0.15, 2.4, 0, Math.PI * 2); ctx.fill();
                if (this.gbSlashT > 0) {
                    const k = this.gbSlashT / 12;
                    ctx.beginPath(); ctx.arc(this.x, this.y, R + 22, this.gbAng - 1.0 + (1 - k) * 0.6, this.gbAng + 1.0 + (1 - k) * 0.6);
                    ctx.strokeStyle = (fm ? 'rgba(248, 187, 208, ' : 'rgba(206, 147, 216, ') + k + ')'; ctx.lineWidth = 8 * k + 2; ctx.lineCap = 'round'; ctx.stroke(); ctx.lineCap = 'butt';
                }
                if (this.gbCharge > 0) {
                    const k = 1 - this.gbCharge / this.gbChargeMax, orr = 4 + k * 15;
                    const ox = this.x + Math.cos(this.gbAng) * (R + 10), oy = this.y + Math.sin(this.gbAng) * (R + 10);
                    ctx.beginPath(); ctx.arc(ox, oy, orr + 6, 0, Math.PI * 2); ctx.fillStyle = fm ? 'rgba(244, 143, 177, 0.4)' : 'rgba(171, 71, 188, 0.4)'; ctx.fill();
                    ctx.beginPath(); ctx.arc(ox, oy, orr, 0, Math.PI * 2); ctx.fillStyle = '#fce4ec'; ctx.fill();
                }
                if (this.gbBeamT > 0) {
                    const k = this.gbBeamT / 16;
                    const ex = this.x + Math.cos(this.gbAng) * 900, ey = this.y + Math.sin(this.gbAng) * 900;
                    ctx.lineCap = 'round';
                    ctx.beginPath(); ctx.moveTo(this.x, this.y); ctx.lineTo(ex, ey);
                    ctx.strokeStyle = (fm ? 'rgba(236, 64, 122, ' : 'rgba(123, 31, 162, ') + (0.6 * k) + ')'; ctx.lineWidth = 30 * k; ctx.stroke();
                    ctx.strokeStyle = 'rgba(255, 255, 255, ' + k + ')'; ctx.lineWidth = 12 * k; ctx.stroke();
                    ctx.lineCap = 'butt';
                }
                if (this.gbFlash > 0) {
                    ctx.beginPath(); ctx.arc(this.x, this.y, R + (60 - this.gbFlash) * 2.2, 0, Math.PI * 2);
                    ctx.strokeStyle = 'rgba(248, 187, 208, ' + (this.gbFlash / 60) + ')'; ctx.lineWidth = 4; ctx.stroke();
                }
                if (fm) {
                    ctx.fillStyle = 'rgba(248, 187, 208, 0.95)'; ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'center';
                    ctx.fillText('ROSÉ', this.x, this.y + R + 16);
                }
            }
            // Вегета: торчащие волосы (чёрные / синие / фиолетовые), броня, аура, лучи
            if (this.type === 'vegeta') {
                const fm = this.vgForm, R = this.radius;
                const hair = fm === 2 ? '#b388ff' : fm === 1 ? '#4fc3f7' : '#141414';
                if (fm > 0) {
                    const pulse = Math.sin(Date.now() / 80) * 2.5;
                    ctx.beginPath(); ctx.arc(this.x, this.y, R + 9 + pulse + (fm === 2 ? Math.min(10, this.vgStacks * 0.4) : 0), 0, Math.PI * 2);
                    ctx.fillStyle = fm === 2 ? 'rgba(186, 104, 200, 0.30)' : 'rgba(79, 195, 247, 0.22)'; ctx.fill();
                    ctx.strokeStyle = fm === 2 ? 'rgba(225, 190, 231, 0.95)' : 'rgba(129, 212, 250, 0.95)'; ctx.lineWidth = 2.5; ctx.stroke();
                }
                // белая броня-пластина и золотые наплечники
                ctx.fillStyle = '#eceff1';
                ctx.fillRect(this.x - R * 0.7, this.y + R * 0.1, R * 1.4, R * 0.45);
                ctx.fillStyle = '#fbc02d';
                ctx.fillRect(this.x - R * 0.7, this.y + R * 0.1, 4, R * 0.45);
                ctx.fillRect(this.x + R * 0.7 - 4, this.y + R * 0.1, 4, R * 0.45);
                // волосы пламенем вверх
                ctx.fillStyle = hair;
                for (let k = -2; k <= 2; k++) {
                    const hx = this.x + k * R * 0.38;
                    ctx.beginPath();
                    ctx.moveTo(hx - 5, this.y - R * 0.7);
                    ctx.lineTo(hx + k * 1.5, this.y - R - 17 + Math.abs(k) * 5);
                    ctx.lineTo(hx + 5, this.y - R * 0.7);
                    ctx.fill();
                    ctx.strokeStyle = fm ? 'rgba(255,255,255,0.8)' : '#9e9e9e'; ctx.lineWidth = 1.5; ctx.stroke();
                }
                // мыс волос и сердитые брови
                ctx.fillStyle = hair;
                ctx.beginPath(); ctx.moveTo(this.x - R * 0.4, this.y - R * 0.6); ctx.lineTo(this.x, this.y - R * 0.2); ctx.lineTo(this.x + R * 0.4, this.y - R * 0.6); ctx.fill();
                ctx.strokeStyle = '#000'; ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(this.x - R * 0.55, this.y - R * 0.18); ctx.lineTo(this.x - R * 0.1, this.y - R * 0.02);
                ctx.moveTo(this.x + R * 0.55, this.y - R * 0.18); ctx.lineTo(this.x + R * 0.1, this.y - R * 0.02);
                ctx.stroke();
                ctx.fillStyle = fm === 2 ? '#e040fb' : '#fff';
                ctx.beginPath(); ctx.arc(this.x - R * 0.3, this.y + R * 0.05, 2.2, 0, Math.PI * 2); ctx.arc(this.x + R * 0.3, this.y + R * 0.05, 2.2, 0, Math.PI * 2); ctx.fill();
                if (this.vgPunchT > 0) {
                    const reach = R + 6 + (8 - this.vgPunchT) * 2.5;
                    ctx.beginPath(); ctx.arc(this.x + Math.cos(this.vgAng) * reach, this.y + Math.sin(this.vgAng) * reach, 8, 0, Math.PI * 2);
                    ctx.fillStyle = '#eceff1'; ctx.fill();
                }
                if (this.vgCharge > 0) {
                    const ff = this.vgChargeType === 'final';
                    const k = 1 - this.vgCharge / this.vgChargeMax, orr = 4 + k * (ff ? 22 : 15);
                    const ox = this.x + Math.cos(this.vgAng) * (R + 10), oy = this.y + Math.sin(this.vgAng) * (R + 10);
                    ctx.beginPath(); ctx.arc(ox, oy, orr + 6, 0, Math.PI * 2); ctx.fillStyle = ff ? 'rgba(255, 235, 59, 0.35)' : 'rgba(186, 104, 200, 0.4)'; ctx.fill();
                    ctx.beginPath(); ctx.arc(ox, oy, orr, 0, Math.PI * 2); ctx.fillStyle = ff ? '#fffde7' : '#f3e5f5'; ctx.fill();
                }
                if (this.vgBeamT > 0) {
                    const ff = this.vgBeamType === 'final';
                    const k = this.vgBeamT / (ff ? 20 : 16);
                    const ex = this.x + Math.cos(this.vgAng) * 900, ey = this.y + Math.sin(this.vgAng) * 900;
                    ctx.lineCap = 'round';
                    ctx.beginPath(); ctx.moveTo(this.x, this.y); ctx.lineTo(ex, ey);
                    ctx.strokeStyle = (ff ? 'rgba(255, 213, 79, ' : 'rgba(171, 71, 188, ') + (0.6 * k) + ')'; ctx.lineWidth = (ff ? 46 : 30) * k; ctx.stroke();
                    ctx.strokeStyle = 'rgba(255, 255, 255, ' + k + ')'; ctx.lineWidth = (ff ? 18 : 12) * k; ctx.stroke();
                    ctx.lineCap = 'butt';
                }
                if (this.vgFlash > 0) {
                    ctx.beginPath(); ctx.arc(this.x, this.y, R + (60 - this.vgFlash) * 2.2, 0, Math.PI * 2);
                    ctx.strokeStyle = (fm === 2 ? 'rgba(225, 190, 231, ' : 'rgba(129, 212, 250, ') + (this.vgFlash / 60) + ')'; ctx.lineWidth = 4; ctx.stroke();
                }
                if (fm) {
                    ctx.fillStyle = fm === 2 ? 'rgba(225, 190, 231, 0.95)' : 'rgba(129, 212, 250, 0.95)'; ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'center';
                    ctx.fillText(fm === 2 ? 'ULTRA EGO ×' + (1 + this.vgStacks) : 'SSB', this.x, this.y + R + 16);
                }
                if (this.vgRival) { ctx.fillStyle = 'rgba(255, 213, 79, 0.95)'; ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('RIVALS', this.x, this.y + R + (fm ? 27 : 16)); }
            }
            // Гоку: чёрные (в УИ — серебристые) волосы, аура, Камехамеха
            if (this.type === 'goku') {
                const ui = this.gkUI, R = this.radius;
                if (this.gkGhost) {
                    ctx.beginPath(); ctx.arc(this.gkGhost.x, this.gkGhost.y, R, 0, Math.PI * 2);
                    ctx.fillStyle = 'rgba(207, 216, 220, ' + (this.gkGhost.t / 16 * 0.55) + ')'; ctx.fill();
                }
                if (ui > 0) {
                    const pulse = Math.sin(Date.now() / 90) * 2;
                    ctx.beginPath(); ctx.arc(this.x, this.y, R + 8 + pulse + ui * 3, 0, Math.PI * 2);
                    ctx.fillStyle = 'rgba(190, 215, 255, ' + (ui === 2 ? 0.28 : 0.16) + ')'; ctx.fill();
                    ctx.strokeStyle = 'rgba(224, 247, 250, 0.9)'; ctx.lineWidth = ui === 2 ? 3 : 2; ctx.stroke();
                }
                ctx.fillStyle = ui ? '#eceff1' : '#141414';
                for (let k = -2; k <= 2; k++) {
                    const hx = this.x + k * R * 0.4;
                    ctx.beginPath();
                    ctx.moveTo(hx - 5, this.y - R * 0.75);
                    ctx.lineTo(hx + k * 4, this.y - R - 12 + Math.abs(k) * 3);
                    ctx.lineTo(hx + 5, this.y - R * 0.75);
                    ctx.fill();
                    ctx.strokeStyle = ui ? '#90a4ae' : '#9e9e9e'; ctx.lineWidth = 1.5; ctx.stroke();
                }
                // синий пояс и глаза
                ctx.fillStyle = '#1565c0';
                ctx.fillRect(this.x - R * 0.8, this.y + R * 0.2, R * 1.6, 4);
                ctx.fillStyle = ui ? '#b0bec5' : '#000';
                ctx.beginPath(); ctx.arc(this.x - R * 0.32, this.y - R * 0.15, 2.4, 0, Math.PI * 2); ctx.arc(this.x + R * 0.32, this.y - R * 0.15, 2.4, 0, Math.PI * 2); ctx.fill();
                if (this.gkPunchT > 0) {
                    const reach = R + 6 + (8 - this.gkPunchT) * 2.5;
                    ctx.beginPath(); ctx.arc(this.x + Math.cos(this.gkAng) * reach, this.y + Math.sin(this.gkAng) * reach, 8, 0, Math.PI * 2);
                    ctx.fillStyle = '#ffcc80'; ctx.fill();
                }
                if (this.gkKame > 0) {
                    const k = 1 - this.gkKame / 45, orr = 4 + k * 16;
                    const ox = this.x + Math.cos(this.gkAng) * (R + 10), oy = this.y + Math.sin(this.gkAng) * (R + 10);
                    ctx.beginPath(); ctx.arc(ox, oy, orr + 6, 0, Math.PI * 2); ctx.fillStyle = 'rgba(100, 181, 246, 0.35)'; ctx.fill();
                    ctx.beginPath(); ctx.arc(ox, oy, orr, 0, Math.PI * 2); ctx.fillStyle = '#e3f2fd'; ctx.fill();
                }
                if (this.gkBeamT > 0) {
                    const k = this.gkBeamT / 16;
                    const ex = this.x + Math.cos(this.gkAng) * 900, ey = this.y + Math.sin(this.gkAng) * 900;
                    ctx.lineCap = 'round';
                    ctx.beginPath(); ctx.moveTo(this.x, this.y); ctx.lineTo(ex, ey);
                    ctx.strokeStyle = 'rgba(66, 165, 245, ' + (0.6 * k) + ')'; ctx.lineWidth = 34 * k; ctx.stroke();
                    ctx.strokeStyle = 'rgba(255, 255, 255, ' + k + ')'; ctx.lineWidth = 14 * k; ctx.stroke();
                    ctx.lineCap = 'butt';
                }
                if (this.gkFlash > 0) {
                    ctx.beginPath(); ctx.arc(this.x, this.y, R + (60 - this.gkFlash) * 2.2, 0, Math.PI * 2);
                    ctx.strokeStyle = 'rgba(224, 247, 250, ' + (this.gkFlash / 60) + ')'; ctx.lineWidth = 4; ctx.stroke();
                }
                if (ui) {
                    ctx.fillStyle = 'rgba(224, 247, 250, 0.95)'; ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'center';
                    ctx.fillText(ui === 2 ? 'MASTERED UI' : 'UI -SIGN-', this.x, this.y + R + 16);
                }
                if (this.gkRival) { ctx.fillStyle = 'rgba(255, 213, 79, 0.95)'; ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('RIVALS', this.x, this.y + R + (ui ? 27 : 16)); }
            }
            // Аои Тодо: шрам-крест, повязка, хлопок
            if (this.type === 'todo') {
                ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
                ctx.beginPath();
                ctx.moveTo(this.x - this.radius * 0.45, this.y - this.radius * 0.5); ctx.lineTo(this.x + this.radius * 0.45, this.y + this.radius * 0.5);
                ctx.moveTo(this.x + this.radius * 0.45, this.y - this.radius * 0.5); ctx.lineTo(this.x - this.radius * 0.45, this.y + this.radius * 0.5);
                ctx.stroke();
                ctx.fillStyle = '#b71c1c';
                ctx.fillRect(this.x - this.radius * 0.9, this.y - this.radius * 0.75, this.radius * 1.8, 4);
                ctx.lineCap = 'butt';
                ctx.beginPath(); ctx.arc(this.x, this.y, this.radius + 4, 0, Math.PI * 2);
                ctx.strokeStyle = this.tdBro ? 'rgba(255, 213, 79, 0.95)' : 'rgba(215, 204, 200, 0.8)'; ctx.lineWidth = 2; ctx.stroke();
                if (this.tdClapFx > 0) {
                    ctx.beginPath(); ctx.arc(this.x, this.y, this.radius + (14 - this.tdClapFx) * 3, 0, Math.PI * 2);
                    ctx.strokeStyle = 'rgba(255, 235, 59, ' + (this.tdClapFx / 14) + ')'; ctx.lineWidth = 3; ctx.stroke();
                }
                if (this.tdPunchT > 0) {
                    const reach = this.radius + 6 + (10 - this.tdPunchT) * 2;
                    ctx.beginPath(); ctx.arc(this.x + Math.cos(this.tdAng) * reach, this.y + Math.sin(this.tdAng) * reach, 9, 0, Math.PI * 2);
                    ctx.fillStyle = '#d7ccc8'; ctx.fill();
                }
                if (this.tdBro) { ctx.fillStyle = 'rgba(255, 213, 79, 0.95)'; ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('BROTHERS', this.x, this.y + this.radius + 16); }
            }
            // Юджи: розовые волосы, кулак, чёрная вспышка
            if (this.type === 'yuji') {
                ctx.fillStyle = '#f48fb1';
                for (let k = -2; k <= 2; k++) {
                    const hx = this.x + k * this.radius * 0.38;
                    ctx.beginPath();
                    ctx.moveTo(hx - 4, this.y - this.radius * 0.8);
                    ctx.lineTo(hx + k * 2, this.y - this.radius - 9);
                    ctx.lineTo(hx + 4, this.y - this.radius * 0.8);
                    ctx.fill();
                }
                // метки на шаре вращаются — видно, что он катится
                const rl = this.yjRoll || 0;
                ctx.strokeStyle = 'rgba(255, 245, 240, 0.9)'; ctx.lineWidth = 3; ctx.lineCap = 'round';
                for (let k = 0; k < 2; k++) {
                    const a = rl + k * Math.PI;
                    ctx.beginPath();
                    ctx.moveTo(this.x + Math.cos(a) * this.radius * 0.35, this.y + Math.sin(a) * this.radius * 0.35);
                    ctx.lineTo(this.x + Math.cos(a) * this.radius * 0.85, this.y + Math.sin(a) * this.radius * 0.85);
                    ctx.stroke();
                }
                ctx.lineCap = 'butt';
                if (this.yjBro) { ctx.fillStyle = 'rgba(255, 213, 79, 0.95)'; ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('BROTHERS', this.x, this.y + this.radius + 16); }
                if (this.yjKoku > 0) {
                    const kx = Math.max(70, Math.min(W - 70, this.x));
                    ctx.save();
                    ctx.globalAlpha = Math.min(1, this.yjKoku / 20);
                    ctx.textAlign = 'center';
                    ctx.font = 'bold 22px sans-serif';
                    ctx.lineWidth = 4; ctx.strokeStyle = '#000'; ctx.strokeText('KOKUSEN', kx, this.y - this.radius - 30);
                    ctx.fillStyle = '#ff1744'; ctx.fillText('KOKUSEN', kx, this.y - this.radius - 30);
                    ctx.font = 'bold 14px sans-serif'; ctx.fillStyle = '#fff'; ctx.fillText('黒閃', kx, this.y - this.radius - 48);
                    ctx.restore();
                }
                // метки Сукуны на лице (чёрные полосы под глазами) и красные глаза
                ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 2;
                for (let k = -1; k <= 1; k += 2) {
                    ctx.beginPath();
                    ctx.moveTo(this.x + k * this.radius * 0.2, this.y - this.radius * 0.1);
                    ctx.lineTo(this.x + k * this.radius * 0.7, this.y + this.radius * 0.1);
                    ctx.moveTo(this.x + k * this.radius * 0.2, this.y + this.radius * 0.15);
                    ctx.lineTo(this.x + k * this.radius * 0.7, this.y + this.radius * 0.35);
                    ctx.stroke();
                    ctx.fillStyle = '#ff1744';
                    ctx.beginPath(); ctx.arc(this.x + k * this.radius * 0.35, this.y - this.radius * 0.2, 2.2, 0, Math.PI * 2); ctx.fill();
                }
                if (this.yjZoneMode > 0) {
                    ctx.beginPath(); ctx.arc(this.x, this.y, this.radius + 11 + Math.sin(Date.now() / 90) * 2, 0, Math.PI * 2);
                    ctx.strokeStyle = 'rgba(255, 40, 40, 0.8)'; ctx.lineWidth = 3; ctx.stroke();
                    ctx.fillStyle = 'rgba(255, 82, 82, 0.95)'; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center';
                    ctx.fillText('THE ZONE', this.x, this.y - this.radius - 20);
                }
                ctx.beginPath(); ctx.arc(this.x, this.y, this.radius + 4, 0, Math.PI * 2);
                ctx.strokeStyle = this.yjZone > 0 ? 'rgba(255, 60, 60, 0.9)' : 'rgba(255, 204, 188, 0.8)'; ctx.lineWidth = 2; ctx.stroke();
                if (this.yjPunchT > 0) {
                    const reach = this.radius + 6 + (10 - this.yjPunchT) * 2;
                    ctx.beginPath(); ctx.arc(this.x + Math.cos(this.yjAng) * reach, this.y + Math.sin(this.yjAng) * reach, 7, 0, Math.PI * 2);
                    ctx.fillStyle = '#ffccbc'; ctx.fill();
                }
                if (this.yjFlash > 0) {
                    ctx.strokeStyle = 'rgba(255, 30, 30, 0.95)'; ctx.lineWidth = 2;
                    for (let k = 0; k < 6; k++) {
                        const a0 = Math.random() * Math.PI * 2;
                        ctx.beginPath();
                        ctx.moveTo(this.x + Math.cos(a0) * this.radius, this.y + Math.sin(a0) * this.radius);
                        ctx.lineTo(this.x + Math.cos(a0 + 0.3) * (this.radius + 14), this.y + Math.sin(a0 + 0.3) * (this.radius + 14));
                        ctx.lineTo(this.x + Math.cos(a0 - 0.2) * (this.radius + 26), this.y + Math.sin(a0 - 0.2) * (this.radius + 26));
                        ctx.stroke();
                    }
                }
            }
            // Наоя Дзэнин — «киноплёнка»: кольцо из 24 делений, образы рывка, прицел
            if (this.type === 'naoya') {
                const ball = this;
                this.afterimages.forEach(function (a) {
                    ctx.globalAlpha = Math.max(0, a.life / 14) * 0.45;
                    ctx.beginPath();
                    ctx.arc(a.x, a.y, ball.radius, 0, Math.PI * 2);
                    ctx.fillStyle = '#ffca28';
                    ctx.fill();
                });
                ctx.globalAlpha = 1;
                for (let i = 0; i < 24; i++) {
                    const a = i * Math.PI * 2 / 24 + this.frameRing;
                    const lit = this.naoyaPhase === 'aim' && i < this.naoyaTimer;
                    ctx.beginPath();
                    ctx.moveTo(this.x + Math.cos(a) * (this.radius + 4), this.y + Math.sin(a) * (this.radius + 4));
                    ctx.lineTo(this.x + Math.cos(a) * (this.radius + 9), this.y + Math.sin(a) * (this.radius + 9));
                    ctx.strokeStyle = lit ? 'rgba(255, 255, 255, 0.95)' : 'rgba(255, 202, 40, 0.85)';
                    ctx.lineWidth = 2;
                    ctx.stroke();
                }
                if (this.naoyaPhase === 'aim') {
                    ctx.beginPath();
                    ctx.moveTo(this.x, this.y);
                    ctx.lineTo(this.x + Math.cos(this.targetAngle) * 300, this.y + Math.sin(this.targetAngle) * 300);
                    ctx.setLineDash([6, 6]);
                    ctx.strokeStyle = 'rgba(255, 240, 150, 0.75)';
                    ctx.lineWidth = 2;
                    ctx.stroke();
                    ctx.setLineDash([]);
                }
                const ft = this.naoyaPhase === 'combo' ? this.naoyaTarget : null;
                if (ft) {
                    // рамка видоискателя вокруг замороженной цели
                    const q = ft.radius + 12, c = 8;
                    ctx.strokeStyle = 'rgba(255, 235, 59, 0.95)';
                    ctx.lineWidth = 3;
                    [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(function (k) {
                        ctx.beginPath();
                        ctx.moveTo(ft.x + k[0] * q, ft.y + k[1] * (q - c));
                        ctx.lineTo(ft.x + k[0] * q, ft.y + k[1] * q);
                        ctx.lineTo(ft.x + k[0] * (q - c), ft.y + k[1] * q);
                        ctx.stroke();
                    });
                }
            }
            // замедлен полем времени
            if (this.slowT > 0) {
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.radius + 6, 0, Math.PI * 2);
                ctx.setLineDash([3, 4]);
                ctx.strokeStyle = 'rgba(255, 224, 130, 0.9)';
                ctx.lineWidth = 2;
                ctx.stroke();
                ctx.setLineDash([]);
            }
            // Бог времени: поле, циферблат, перемотка
            if (this.type === 'timegod') {
                if (this.zoneT > 0) {
                    const fade = Math.min(1, this.zoneT / 30);
                    ctx.beginPath();
                    ctx.arc(this.x, this.y, TG_ZONE_R, 0, Math.PI * 2);
                    ctx.fillStyle = 'rgba(255, 213, 79, ' + (0.08 * fade) + ')';
                    ctx.fill();
                    ctx.setLineDash([8, 6]);
                    ctx.lineDashOffset = this.zoneT * 0.8;
                    ctx.strokeStyle = 'rgba(255, 224, 130, ' + (0.7 * fade) + ')';
                    ctx.lineWidth = 2;
                    ctx.stroke();
                    ctx.setLineDash([]);
                    ctx.lineDashOffset = 0;
                    for (let i = 0; i < 12; i++) {
                        const a = i * Math.PI / 6;
                        ctx.beginPath();
                        ctx.moveTo(this.x + Math.cos(a) * (TG_ZONE_R - 10), this.y + Math.sin(a) * (TG_ZONE_R - 10));
                        ctx.lineTo(this.x + Math.cos(a) * TG_ZONE_R, this.y + Math.sin(a) * TG_ZONE_R);
                        ctx.strokeStyle = 'rgba(255, 224, 130, ' + (0.8 * fade) + ')';
                        ctx.stroke();
                    }
                    ctx.beginPath();
                    ctx.moveTo(this.x, this.y);
                    ctx.lineTo(this.x + Math.cos(this.clockAng * 3) * (TG_ZONE_R - 14), this.y + Math.sin(this.clockAng * 3) * (TG_ZONE_R - 14));
                    ctx.strokeStyle = 'rgba(255, 245, 157, ' + (0.8 * fade) + ')';
                    ctx.lineWidth = 3;
                    ctx.stroke();
                }
            }
            // Простой домен: купол вокруг шара, дуга показывает прочность
            if (this.simpleActive) {
                const rr = this.radius + 26;
                const left = Math.max(0, this.simpleHp) / SIMPLE_HP;
                ctx.beginPath();
                ctx.arc(this.x, this.y, rr, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(178, 235, 242, ' + (0.08 + 0.1 * left) + ')';
                ctx.fill();
                ctx.setLineDash([7, 5]);
                ctx.lineDashOffset = -this.simpleT * 0.6;
                ctx.strokeStyle = 'rgba(224, 247, 250, 0.9)';
                ctx.lineWidth = 2;
                ctx.stroke();
                ctx.setLineDash([]);
                ctx.lineDashOffset = 0;
                ctx.beginPath();
                ctx.arc(this.x, this.y, rr + 4, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * left);
                ctx.strokeStyle = left > 0.35 ? 'rgba(77, 208, 225, 0.95)' : 'rgba(255, 112, 67, 0.95)';
                ctx.lineWidth = 3;
                ctx.stroke();
            }
            // Cosmic Alien: аура, метеориты, кольца взрывов, сверхновая
            if (this.type === 'cosmic') {
                const t = this.wSpin;
                const fear = this.cmFear;
                // аура
                const ar = this.radius + 14 + Math.sin(t * 3) * 3;
                const ag = ctx.createRadialGradient(this.x, this.y, this.radius * 0.6, this.x, this.y, ar + 10);
                ag.addColorStop(0, fear ? 'rgba(255, 82, 82, 0.55)' : 'rgba(124, 77, 255, 0.5)');
                ag.addColorStop(1, fear ? 'rgba(255, 82, 82, 0)' : 'rgba(38, 198, 218, 0)');
                ctx.fillStyle = ag;
                ctx.beginPath();
                ctx.arc(this.x, this.y, ar + 10, 0, Math.PI * 2);
                ctx.fill();
                // орбитальные звёзды
                for (let i = 0; i < 4; i++) {
                    const a = t * 2 + i * Math.PI / 2;
                    ctx.fillStyle = fear ? '#ff8a80' : '#b2ebf2';
                    ctx.beginPath();
                    ctx.arc(this.x + Math.cos(a) * (this.radius + 9), this.y + Math.sin(a) * (this.radius + 9), 2.5, 0, Math.PI * 2);
                    ctx.fill();
                }
                // сверхновая: растущая сфера
                if (this.cmState === 'nova') {
                    const k = Math.min(1, this.cmT / 90), r = 10 + 60 * k;
                    const ng = ctx.createRadialGradient(this.x, this.y, 2, this.x, this.y, r * 1.4);
                    ng.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
                    ng.addColorStop(0.4, 'rgba(255, 213, 79, 0.8)');
                    ng.addColorStop(1, 'rgba(255, 112, 67, 0)');
                    ctx.fillStyle = ng;
                    ctx.beginPath();
                    ctx.arc(this.x, this.y, r * 1.4, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.beginPath();
                    ctx.arc(this.x, this.y, this.cmFear ? 320 * (1 - k * 0.0) : 250, 0, Math.PI * 2);
                    ctx.strokeStyle = 'rgba(255, 213, 79, ' + (0.15 + 0.2 * k) + ')';
                    ctx.setLineDash([8, 8]);
                    ctx.lineWidth = 2;
                    ctx.stroke();
                    ctx.setLineDash([]);
                }
                // кольцо взрыва
                if (this.cmBlast > 0) {
                    const bk = 1 - this.cmBlast / 30;
                    ctx.beginPath();
                    ctx.arc(this.x, this.y, this.cmBlastR * bk, 0, Math.PI * 2);
                    ctx.strokeStyle = 'rgba(255, 224, 130, ' + (0.9 * (1 - bk)) + ')';
                    ctx.lineWidth = 8 * (1 - bk) + 2;
                    ctx.stroke();
                }
                // метеориты: предупреждение, падение, взрыв
                this.cmMeteors.forEach(function (m) {
                    if (m.t < 0) return;
                    if (m.t < 45) {
                        const k = m.t / 45;
                        ctx.beginPath();
                        ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
                        ctx.strokeStyle = 'rgba(255, 82, 82, ' + (0.35 + 0.4 * k) + ')';
                        ctx.lineWidth = 2;
                        ctx.stroke();
                        ctx.beginPath();
                        ctx.arc(m.x, m.y, m.r * k, 0, Math.PI * 2);
                        ctx.fillStyle = 'rgba(255, 82, 82, ' + (0.12 + 0.18 * k) + ')';
                        ctx.fill();
                        // падающий камень
                        const hx = m.x + (1 - k) * 110, hy = m.y - (1 - k) * 260;
                        ctx.strokeStyle = 'rgba(255, 183, 77, 0.8)';
                        ctx.lineWidth = 5;
                        ctx.beginPath();
                        ctx.moveTo(hx + 40, hy - 95);
                        ctx.lineTo(hx, hy);
                        ctx.stroke();
                        ctx.fillStyle = '#ffcc80';
                        ctx.beginPath();
                        ctx.arc(hx, hy, 7, 0, Math.PI * 2);
                        ctx.fill();
                    } else {
                        const bk = 1 - m.boom / 16;
                        ctx.beginPath();
                        ctx.arc(m.x, m.y, m.r * (0.5 + bk), 0, Math.PI * 2);
                        ctx.fillStyle = 'rgba(255, 171, 64, ' + (0.6 * (1 - bk)) + ')';
                        ctx.fill();
                    }
                });
                // скопированный приём: луч к цели / удар-вспышка
                if ((this.cmState === 'cbeam' || this.cmZap > 0) && this.cmTarget && !this.cmTarget.out) {
                    const tg = this.cmTarget, a = this.cmState === 'cbeam' ? 1 : this.cmZap / 14;
                    const jx = (Math.random() - 0.5) * 6, jy = (Math.random() - 0.5) * 6;
                    const lg = ctx.createLinearGradient(this.x, this.y, tg.x, tg.y);
                    lg.addColorStop(0, 'rgba(179, 136, 255, ' + a + ')');
                    lg.addColorStop(1, 'rgba(255, 255, 255, ' + a + ')');
                    ctx.strokeStyle = lg;
                    ctx.lineWidth = this.cmState === 'cbeam' ? 7 : 5;
                    ctx.lineCap = 'round';
                    ctx.beginPath();
                    ctx.moveTo(this.x, this.y);
                    ctx.lineTo(tg.x + jx, tg.y + jy);
                    ctx.stroke();
                    ctx.beginPath();
                    ctx.arc(tg.x, tg.y, tg.radius + 8 + (1 - a) * 14, 0, Math.PI * 2);
                    ctx.strokeStyle = 'rgba(224, 187, 255, ' + a + ')';
                    ctx.lineWidth = 3;
                    ctx.stroke();
                    ctx.lineCap = 'butt';
                }
                // вспышка телепорта
                if (this.cmFx > 0) {
                    ctx.beginPath();
                    ctx.arc(this.x, this.y, this.radius + (1 - this.cmFx / 20) * 34, 0, Math.PI * 2);
                    ctx.strokeStyle = 'rgba(128, 222, 234, ' + (this.cmFx / 20) + ')';
                    ctx.lineWidth = 3;
                    ctx.stroke();
                }
            }
            // Клон: вспышка при создании копии
            if (this.type === 'cloner' && this.clFx > 0) {
                const kd = 1 - this.clFx / 20;
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.radius + kd * 40, 0, Math.PI * 2);
                ctx.strokeStyle = 'rgba(128, 222, 234, ' + (0.9 * (1 - kd)) + ')';
                ctx.lineWidth = 3;
                ctx.stroke();
            }
            // Doubling: вспышка удвоения и «двойники», кружащие вокруг
            if (this.type === 'doubling') {
                const nSat = Math.min(6, Math.round(Math.log2(this.dbMul)));
                for (let i = 0; i < nSat; i++) {
                    const sa = this.wSpin * (i % 2 ? -1 : 1) + i * Math.PI * 2 / Math.max(1, nSat);
                    ctx.beginPath();
                    ctx.arc(this.x + Math.cos(sa) * (this.radius + 12), this.y + Math.sin(sa) * (this.radius + 12), 6, 0, Math.PI * 2);
                    ctx.fillStyle = 'rgba(225, 190, 255, 0.85)';
                    ctx.fill();
                    ctx.strokeStyle = '#ffd54f';
                    ctx.lineWidth = 1.5;
                    ctx.stroke();
                }
                if (this.dbFx > 0) {
                    const kd = 1 - this.dbFx / 30;
                    ctx.beginPath();
                    ctx.arc(this.x, this.y, this.radius + kd * 130, 0, Math.PI * 2);
                    ctx.strokeStyle = 'rgba(225, 190, 255, ' + (0.9 * (1 - kd)) + ')';
                    ctx.lineWidth = 4;
                    ctx.stroke();
                }
            }
            // Роблокс Егор: шлейф, клоны, чипсы, заряд мультивселенной, истинная форма
            if (this.type === 'egor') {
                const eb = this;
                if (this.wSit > 0) {
                    const cr = this.radius;
                    ctx.save();
                    ctx.fillStyle = '#263238';
                    ctx.strokeStyle = '#b2ff59';
                    ctx.lineWidth = 2;
                    ctx.beginPath(); ctx.rect(this.x - cr - 7, this.y - cr - 18, 2 * cr + 14, cr + 18); ctx.fill(); ctx.stroke();
                    ctx.beginPath(); ctx.rect(this.x - cr - 12, this.y + cr * 0.65, 2 * cr + 24, 9); ctx.fill(); ctx.stroke();
                    ctx.beginPath();
                    ctx.moveTo(this.x - cr - 6, this.y + cr * 0.65 + 9); ctx.lineTo(this.x - cr - 10, this.y + cr + 16);
                    ctx.moveTo(this.x + cr + 6, this.y + cr * 0.65 + 9); ctx.lineTo(this.x + cr + 10, this.y + cr + 16);
                    ctx.stroke();
                    ctx.fillStyle = 'rgba(178, 255, 89, 0.95)';
                    ctx.font = 'bold 12px sans-serif';
                    ctx.textAlign = 'center';
                    ctx.fillText('MÖBIUS CHAIR', this.x, this.y + cr + 32);
                    ctx.restore();
                }
                if (this.wStandFx > 0) {
                    const kk = 1 - this.wStandFx / 40;
                    ctx.beginPath();
                    ctx.arc(this.x, this.y, this.radius + kk * 150, 0, Math.PI * 2);
                    ctx.strokeStyle = 'rgba(178, 255, 89, ' + (0.9 * (1 - kk)) + ')';
                    ctx.lineWidth = 4;
                    ctx.stroke();
                }
                if (this.egMul > 1 && this.wSit <= 0) {
                    ctx.fillStyle = 'rgba(178, 255, 89, 0.95)';
                    ctx.font = 'bold 11px sans-serif';
                    ctx.textAlign = 'center';
                    ctx.fillText('ALL ×1000', this.x, this.y + this.radius + 16);
                }
                this.afterimages.forEach(function (a) {
                    ctx.globalAlpha = Math.max(0, a.life / 14) * 0.45;
                    ctx.beginPath();
                    ctx.arc(a.x, a.y, eb.radius, 0, Math.PI * 2);
                    ctx.fillStyle = '#b2ff59';
                    ctx.fill();
                });
                ctx.globalAlpha = 1;
                this.egClones.forEach(function (c) {
                    ctx.globalAlpha = 0.75;
                    ctx.beginPath(); ctx.arc(c.x, c.y, 14, 0, Math.PI * 2);
                    ctx.fillStyle = '#37474f'; ctx.fill();
                    ctx.fillStyle = '#f5f5f5'; ctx.fillRect(c.x - 7, c.y - 13, 14, 11);
                    ctx.globalAlpha = 1;
                    ctx.strokeStyle = '#b2ff59'; ctx.lineWidth = 2;
                    ctx.beginPath(); ctx.arc(c.x, c.y, 14, 0, Math.PI * 2); ctx.stroke();
                });
                if (this.egMicro > 0 && this.egMicroT) {
                    ctx.fillStyle = '#f5f5f5';
                    for (let i = 0; i < 5; i++) {
                        const a = Math.random() * Math.PI * 2, rr = Math.random() * this.egMicroT.radius * 0.8;
                        ctx.fillRect(this.egMicroT.x + Math.cos(a) * rr - 1, this.egMicroT.y + Math.sin(a) * rr - 1, 3, 3);
                    }
                }
                if (this.egPhase === 'verse') {
                    const k = this.egTimer / 100;
                    ctx.beginPath(); ctx.arc(this.x, this.y, 30 + k * 260, 0, Math.PI * 2);
                    ctx.fillStyle = 'rgba(0, 0, 0, ' + (0.15 + 0.3 * k) + ')'; ctx.fill();
                    ctx.strokeStyle = 'rgba(178, 255, 89, ' + (0.4 + 0.5 * k) + ')'; ctx.lineWidth = 3; ctx.stroke();
                }
                if (this.egPhase === 'true') {
                    const k = this.egTimer / 240;
                    for (let i = 0; i < 3; i++) {
                        ctx.beginPath(); ctx.arc(this.x, this.y, this.radius + 10 + i * 14 + k * 120, 0, Math.PI * 2);
                        ctx.strokeStyle = 'rgba(255, 255, 255, ' + (0.9 - i * 0.25) + ')'; ctx.lineWidth = 3; ctx.stroke();
                    }
                }
            }
            // Уолли Уэст: остаточные образы, аура бесконечной массы, молнии шквала
            if (this.type === 'wally') {
                const wb = this;
                if (this.wSit > 0) {
                    // кресло Мёбиуса
                    const cr = this.radius;
                    ctx.save();
                    ctx.fillStyle = '#263238';
                    ctx.strokeStyle = '#4fc3f7';
                    ctx.lineWidth = 2;
                    ctx.beginPath(); ctx.rect(this.x - cr - 7, this.y - cr - 18, 2 * cr + 14, cr + 18); ctx.fill(); ctx.stroke();
                    ctx.beginPath(); ctx.rect(this.x - cr - 12, this.y + cr * 0.65, 2 * cr + 24, 9); ctx.fill(); ctx.stroke();
                    ctx.beginPath();
                    ctx.moveTo(this.x - cr - 6, this.y + cr * 0.65 + 9); ctx.lineTo(this.x - cr - 10, this.y + cr + 16);
                    ctx.moveTo(this.x + cr + 6, this.y + cr * 0.65 + 9); ctx.lineTo(this.x + cr + 10, this.y + cr + 16);
                    ctx.stroke();
                    ctx.fillStyle = 'rgba(129, 212, 250, 0.95)';
                    ctx.font = 'bold 12px sans-serif';
                    ctx.textAlign = 'center';
                    ctx.fillText('MÖBIUS CHAIR', this.x, this.y + cr + 32);
                    ctx.restore();
                }
                if (this.wStandFx > 0) {
                    const k = 1 - this.wStandFx / 40;
                    ctx.beginPath();
                    ctx.arc(this.x, this.y, this.radius + k * 150, 0, Math.PI * 2);
                    ctx.strokeStyle = 'rgba(129, 212, 250, ' + (0.9 * (1 - k)) + ')';
                    ctx.lineWidth = 4;
                    ctx.stroke();
                }
                this.afterimages.forEach(function (a) {
                    ctx.globalAlpha = Math.max(0, a.life / 14) * 0.5;
                    ctx.beginPath();
                    ctx.arc(a.x, a.y, wb.radius, 0, Math.PI * 2);
                    ctx.fillStyle = '#4fc3f7';
                    ctx.fill();
                });
                ctx.globalAlpha = 1;
                // свечение Силы скорости
                const pulse = 0.5 + 0.5 * Math.sin(this.wSpin * 3);
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.radius + 7 + 3 * pulse, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(79, 195, 247, ' + (0.22 + 0.12 * pulse) + ')';
                ctx.fill();
                // лента Мёбиуса: вращающаяся «восьмёрка» вокруг шара
                ctx.save();
                ctx.translate(this.x, this.y);
                ctx.rotate(this.wSpin);
                ctx.beginPath();
                const la = this.radius + 16;
                for (let i = 0; i <= 48; i++) {
                    const tt = i / 48 * Math.PI * 2;
                    const lx = la * Math.cos(tt) / (1 + Math.sin(tt) * Math.sin(tt));
                    const ly = la * Math.sin(tt) * Math.cos(tt) / (1 + Math.sin(tt) * Math.sin(tt)) * 1.6;
                    if (i === 0) ctx.moveTo(lx, ly); else ctx.lineTo(lx, ly);
                }
                ctx.strokeStyle = 'rgba(179, 229, 252, 0.85)';
                ctx.lineWidth = 2;
                ctx.stroke();
                ctx.restore();
                // электрические дуги
                ctx.strokeStyle = 'rgba(225, 245, 254, 0.9)';
                ctx.lineWidth = 1.5;
                for (let i = 0; i < 2; i++) {
                    const a0 = Math.random() * Math.PI * 2;
                    ctx.beginPath();
                    ctx.moveTo(this.x + Math.cos(a0) * this.radius, this.y + Math.sin(a0) * this.radius);
                    ctx.lineTo(this.x + Math.cos(a0 + 0.15) * (this.radius + 7), this.y + Math.sin(a0 + 0.15) * (this.radius + 7));
                    ctx.lineTo(this.x + Math.cos(a0 - 0.1) * (this.radius + 13), this.y + Math.sin(a0 - 0.1) * (this.radius + 13));
                    ctx.stroke();
                }
                if (this.wPhase === 'mass' || this.wPhase === 'lunge') {
                    const k = this.wPhase === 'mass' ? this.wTimer / 36 : 1;
                    ctx.beginPath();
                    ctx.arc(this.x, this.y, this.radius + 6 + 16 * k, 0, Math.PI * 2);
                    ctx.fillStyle = 'rgba(20, 0, 40, ' + (0.25 + 0.35 * k) + ')';
                    ctx.fill();
                    ctx.strokeStyle = 'rgba(100, 181, 246, 0.95)';
                    ctx.lineWidth = 3;
                    ctx.stroke();
                }
                if (this.wPhase === 'flurry' && this.wTarget) {
                    ctx.strokeStyle = 'rgba(179, 229, 252, 0.95)';
                    ctx.lineWidth = 2;
                    for (let i = 0; i < 4; i++) {
                        const a = Math.random() * Math.PI * 2, r1 = this.wTarget.radius * 0.4, r2 = this.wTarget.radius + 14;
                        ctx.beginPath();
                        ctx.moveTo(this.wTarget.x + Math.cos(a) * r1, this.wTarget.y + Math.sin(a) * r1);
                        ctx.lineTo(this.wTarget.x + Math.cos(a + 0.25) * r2, this.wTarget.y + Math.sin(a + 0.25) * r2);
                        ctx.stroke();
                    }
                }
            }
            // Махорага — большой серый с адаптацией
            if (this.type === 'mahoraga') {
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.radius + 8, 0, Math.PI * 2);
                ctx.strokeStyle = 'rgba(176, 190, 197, 0.95)';
                ctx.lineWidth = 4;
                ctx.stroke();
                // кольца адаптации
                for (let i = 0; i < Math.floor(this.adaptation); i++) {
                    ctx.beginPath();
                    ctx.arc(this.x, this.y, this.radius + 12 + i * 4, 0, Math.PI * 2);
                    ctx.strokeStyle = 'rgba(255, 235, 59, ' + (0.3 + i * 0.08) + ')';
                    ctx.lineWidth = 2;
                    ctx.stroke();
                }
            }

            // зарядка Purple (только Годжо) — растущий шар у Годжо
            if (this.type === 'gojo' && this.isPurpleCharging) {
                const p = this.purpleChargeTimer / 70;
                const cr = 8 + p * 16;
                ctx.beginPath();
                ctx.arc(this.x, this.y, cr + 10, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(156, 39, 176, ' + (0.25 + p * 0.25) + ')';
                ctx.fill();
                ctx.beginPath();
                ctx.arc(this.x, this.y, cr, 0, Math.PI * 2);
                const grad = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, cr);
                grad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
                grad.addColorStop(0.4, 'rgba(224, 64, 251, 0.9)');
                grad.addColorStop(1, 'rgba(123, 31, 162, 0.7)');
                ctx.fillStyle = grad;
                ctx.fill();
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
                ctx.lineWidth = 2;
                ctx.stroke();
            }

            // Летающий шар Hollow Purple
            if (this.type === 'gojo' && this.purpleBall) {
                const pb = this.purpleBall;
                const pulse = 1 + 0.12 * Math.sin(pb.life * 0.4);
                const r = pb.r * pulse;
                // внешнее свечение
                ctx.beginPath();
                ctx.arc(pb.x, pb.y, r * 1.8, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(156, 39, 176, 0.25)';
                ctx.fill();
                // основной шар
                const g = ctx.createRadialGradient(pb.x - r * 0.3, pb.y - r * 0.3, 0, pb.x, pb.y, r);
                g.addColorStop(0, '#ffffff');
                g.addColorStop(0.25, '#e040fb');
                g.addColorStop(0.65, '#9c27b0');
                g.addColorStop(1, '#4a148c');
                ctx.beginPath();
                ctx.arc(pb.x, pb.y, r, 0, Math.PI * 2);
                ctx.fillStyle = g;
                ctx.fill();
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
                ctx.lineWidth = 2;
                ctx.stroke();
                // след
                ctx.beginPath();
                ctx.arc(pb.x - pb.dx * 1.5, pb.y - pb.dy * 1.5, r * 0.55, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(224, 64, 251, 0.35)';
                ctx.fill();
            }

            if (this.stunTimer > 0 && !(domainClash && (domainClash.a === this || domainClash.b === this))) {
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.radius + 10, 0, Math.PI * 2);
                ctx.setLineDash([4, 4]);
                ctx.strokeStyle = 'rgba(255, 255, 0, 0.8)';
                ctx.lineWidth = 2;
                ctx.stroke();
                ctx.setLineDash([]);
                ctx.closePath();
            }

            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
            ctx.fillStyle = this.isRaging ? '#d32f2f' : this.color;
            ctx.fill();
            ctx.closePath();
            if (this.type === 'prism') this.drawPrismBody();
            if (this.opPhase > 0 || this.opFx > 0) this.drawPunch();
            if (this.type === 'robot') this.drawRobot();
            if (this.type === 'author' && this.supreme) this.drawSupreme();
            if (this.type === 'oneshot') {
                this.drawOsMove();
                if (this.osRage) this.drawRage(1);
                else if (cutscene && cutscene.os === this && cutscene.t > 100) this.drawRage(Math.min(1, (cutscene.t - 100) / 60));
            }
            if (this.type === 'cosmic' && this.cmMax > 100) {
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.radius + 9 + Math.sin(this.wSpin * 4) * 2, 0, Math.PI * 2);
                ctx.strokeStyle = 'rgba(255, 214, 79, 0.9)';
                ctx.lineWidth = 3;
                ctx.stroke();
            }
            if (this.type === 'cosmic') {
                const rr = this.radius;
                ctx.save();
                ctx.beginPath();
                ctx.arc(this.x, this.y, rr, 0, Math.PI * 2);
                ctx.clip();
                const ng = ctx.createRadialGradient(this.x - rr * 0.3, this.y - rr * 0.3, 2, this.x, this.y, rr);
                ng.addColorStop(0, this.cmFear ? 'rgba(255, 82, 82, 0.55)' : 'rgba(124, 77, 255, 0.55)');
                ng.addColorStop(1, 'rgba(10, 0, 40, 0)');
                ctx.fillStyle = ng;
                ctx.fillRect(this.x - rr, this.y - rr, rr * 2, rr * 2);
                const sp = this.wSpin * 0.6;
                this.cmStars.forEach(function (st) {
                    const a = st.a + sp * st.s;
                    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
                    ctx.beginPath();
                    ctx.arc(this.x + Math.cos(a) * st.r * rr, this.y + Math.sin(a) * st.r * rr, st.s, 0, Math.PI * 2);
                    ctx.fill();
                }, this);
                ctx.restore();
                ctx.beginPath();
                ctx.arc(this.x, this.y, rr, 0, Math.PI * 2);
                ctx.strokeStyle = this.cmFear ? '#ff8a80' : '#b388ff';
                ctx.lineWidth = 2.5;
                ctx.stroke();
                // уровень адаптации под шаром
                if (this.cmStacks > 0 || this.cmLibN > 0) {
                    ctx.fillStyle = this.cmFear ? '#ff8a80' : '#d1c4e9';
                    ctx.font = 'bold 10px sans-serif';
                    ctx.textAlign = 'center';
                    ctx.fillText('adapt −' + Math.round(this.cmReduce() * 100) + '%' + (this.cmLibN ? ' · copies ' + this.cmLibN : ''), this.x, this.y + rr + 13);
                }
            }
            if (this.type === 'cloner') {
                const grp = this.cloneGroup;
                if (!this.isCopy) {
                    // белая обводка — только у настоящего (оригинала), у клонов её нет
                    ctx.lineWidth = 3;
                    ctx.strokeStyle = '#ffffff';
                    ctx.beginPath();
                    ctx.arc(this.x, this.y, this.radius + 1.5, 0, Math.PI * 2);
                    ctx.stroke();
                }
                // число клонов в группе — внутри тела у каждого (и у оригинала, и у клонов)
                const cnt = balls.filter(function (b) { return !b.out && b.cloneGroup === grp; }).length;
                ctx.fillStyle = '#002b30';
                ctx.font = 'bold 12px sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('×' + cnt, this.x, this.y);
                ctx.textBaseline = 'alphabetic';
            }
            if (this.type === 'doubling') {
                ctx.fillStyle = '#fff8e1';
                ctx.font = 'bold ' + (this.dbMul >= 1e6 ? 9 : 12) + 'px sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('×' + doublingFmt(this.dbMul), this.x, this.y);
                ctx.textBaseline = 'alphabetic';
            }
            if (this.type === 'egor' && this.egRegenFx > 0) {
                // частицы стягиваются к шару
                const t0 = Date.now() / 120;
                for (let i = 0; i < 14; i++) {
                    const an = i * 2.4 + t0, dd = this.radius + 3 + ((i * 7 + this.egRegenFx * 1.5) % 22);
                    ctx.beginPath(); ctx.arc(this.x + Math.cos(an) * dd, this.y + Math.sin(an) * dd, 1.6, 0, Math.PI * 2);
                    ctx.fillStyle = 'rgba(204, 255, 144, ' + Math.min(1, this.egRegenFx / 18) + ')'; ctx.fill();
                }
            }
            if (this.type === 'egor') {
                const er = this.radius;
                ctx.fillStyle = '#f5f5f5';
                ctx.fillRect(this.x - er * 0.5, this.y - er * 0.95, er, er * 0.85);
                ctx.fillStyle = '#212121';
                ctx.fillRect(this.x - er * 0.26, this.y - er * 0.65, 3, 3);
                ctx.fillRect(this.x + er * 0.1, this.y - er * 0.65, 3, 3);
                ctx.beginPath();
                ctx.arc(this.x, this.y - er * 0.4, er * 0.2, 0.15 * Math.PI, 0.85 * Math.PI);
                ctx.strokeStyle = '#212121'; ctx.lineWidth = 1.5; ctx.stroke();
                ctx.fillStyle = '#eeeeee';
                ctx.beginPath();
                ctx.ellipse(this.x - er * 0.42, this.y + er * 0.88, 5, 3, 0, 0, Math.PI * 2);
                ctx.ellipse(this.x + er * 0.42, this.y + er * 0.88, 5, 3, 0, 0, Math.PI * 2);
                ctx.fill();
            }
            if (this.type === 'wally') {
                const r = this.radius;
                ctx.beginPath();
                ctx.moveTo(this.x + 0.15 * r, this.y - 0.8 * r);
                ctx.lineTo(this.x - 0.4 * r, this.y + 0.08 * r);
                ctx.lineTo(this.x - 0.02 * r, this.y + 0.08 * r);
                ctx.lineTo(this.x - 0.18 * r, this.y + 0.8 * r);
                ctx.lineTo(this.x + 0.42 * r, this.y - 0.12 * r);
                ctx.lineTo(this.x + 0.04 * r, this.y - 0.12 * r);
                ctx.closePath();
                ctx.fillStyle = '#e1f5fe';
                ctx.fill();
                ctx.strokeStyle = '#0288d1';
                ctx.lineWidth = 1.5;
                ctx.stroke();
            }
            if (this.type === 'timegod') {
                // циферблат на теле
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.radius - 4, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(255, 248, 225, 0.9)';
                ctx.fill();
                ctx.strokeStyle = '#ffd54f';
                ctx.lineWidth = 2;
                ctx.stroke();
                const spin = this.tgPhase === 'stop' ? 4 : 1;
                ctx.strokeStyle = '#3e2723';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(this.x, this.y);
                ctx.lineTo(this.x + Math.cos(this.clockAng * spin) * (this.radius - 7), this.y + Math.sin(this.clockAng * spin) * (this.radius - 7));
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(this.x, this.y);
                ctx.lineTo(this.x + Math.cos(this.clockAng * spin / 12) * (this.radius - 11), this.y + Math.sin(this.clockAng * spin / 12) * (this.radius - 11));
                ctx.stroke();
                if (this.rewindFx > 0) {
                    ctx.beginPath();
                    ctx.arc(this.x, this.y, 12 + 90 * (this.rewindFx / 45), 0, Math.PI * 2);
                    ctx.strokeStyle = 'rgba(255, 224, 130, ' + (this.rewindFx / 45) + ')';
                    ctx.lineWidth = 4;
                    ctx.stroke();
                }
            }

            ctx.fillStyle = 'white';
            ctx.font = '12px sans-serif';
            ctx.textAlign = 'center';
            if (this.type === 'oneshot' || this.type === 'muha1') {
                ctx.font = 'bold 18px sans-serif';
                ctx.fillText('∞', this.x, this.y - this.radius - 8);
            } else if (this.type === 'muha2') {
                ctx.fillText(Math.max(0, Math.round(this.hp)) + ' ❤', this.x, this.y - this.radius - 8);
            } else if (!this.isCopy) {
                ctx.fillText(Math.max(0, Math.round(this.hp)) + ' HP', this.x, this.y - this.radius - 8);
            }
            if (this.disorientTimer > 0) {
                ctx.fillStyle = '#00f0ff';
                ctx.font = 'bold 18px sans-serif';
                ctx.fillText('?', this.x + 20, this.y - this.radius - 14);
            }
        }

        update() {
            if (this.out) return;
            // игрок (The First Blue Guy): никакие негативные эффекты не действуют
            if (this.isGodTier()) {
                this.stunTimer = 0; this.slowT = 0; this.disorientTimer = 0;
                this.kbTimer = 0; this.kbx = 0; this.kby = 0;
                this.sealed = false; this.isFakeDead = false; this.erased = false;
                if (this.type === 'thefirstblueguy' && this.hp < 100) this.hp = 100;
                if (this.type === 'author' && this.hp < 300) this.hp = 300;
                if (this.type === 'muha1' && this.hp < 100) this.hp = 100;
            }
            // Роблокс Егор: регенерация на субатомном уровне — собирается заново из любой частицы
            if (this.type === 'egor' && !this.out) {
                const mxE = (this.egTrueUsed ? 10000 : 100) * this.egMul;
                if (this.egRegenTxt > 0) this.egRegenTxt--;
                if (this.egRegenFx > 0) this.egRegenFx--;
                if (this.hp <= 0 || this.erased) {
                    this.erased = false; this.eraseTimer = 0; this.sealed = false; this.isFakeDead = false;
                    this.hp = mxE * 0.05;
                    this.egRegenFx = 70;
                    floatingTexts.push(new FloatingText(this.x, this.y - 44, 'REASSEMBLED FROM A SUBATOMIC PARTICLE', '204, 255, 144'));
                    playChargeSound(0.6);
                } else if (this.hp < mxE) {
                    this.hp = Math.min(mxE, this.hp + mxE * 0.01);   // ~1% максимума за кадр
                    this.egRegenFx = Math.max(this.egRegenFx || 0, 18);
                    if (!(this.egRegenTxt > 0)) {
                        this.egRegenTxt = 90;
                        floatingTexts.push(new FloatingText(this.x, this.y - 40, 'SUBATOMIC REGENERATION', '204, 255, 144'));
                    }
                }
            }
            if (this.holdTimer > 0) { this.holdTimer--; return; }
            if (this.afterimages.length) {
                this.afterimages.forEach(function (a) { a.life--; });
                this.afterimages = this.afterimages.filter(function (a) { return a.life > 0; });
            }
            const enemy = this.nearestEnemy();
            if (this.disorientTimer > 0) this.disorientTimer--;
            if (!enemy && (this.type === 'robot' || this.type === 'oneshot')) {
                if (Math.hypot(this.dx, this.dy) < 0.5) this.randomizeVelocity();
                this.x += this.dx; this.y += this.dy;
                return;
            }

            // стёртый шар только растворяется
            if (this.erased) {
                if (this.eraseTimer > 0) this.eraseTimer--;
                return;
            }

            // «мёртвый» автор лежит, потом возвращается
            if (this.isFakeDead) {
                this.fakeDeathTimer--;
                if (this.fakeDeathTimer <= 0) {
                    this.isFakeDead = false;
                    this.hp = this.supreme ? 150 : 50;
                    floatingTexts.push(new FloatingText(this.x, this.y - 30, 'RETURN!', '255, 234, 0'));
                    startTimeStop(this);
                }
                return;
            }

            // Уолли: ни одна остановка (оглушение, заморозка, замедление) на него не действует
            if (this.type === 'wally' || this.type === 'egor') { this.stunTimer = 0; this.slowT = 0; }


            // время остановлено — двигается только тот, кто его остановил
            // активный Анти-Шар не подчиняется остановке времени
            if (timeStopOwner && timeStopOwner !== this && this.type !== 'timegod' && this.type !== 'wally' && this.type !== 'egor' && !this.isGodTier() &&
                !(this.type === 'antiball' && this.antiActive)) return;

            // отбрасывание (скользит даже в оглушении)
            if (this.kbTimer > 0) {
                this.x += this.kbx;
                this.y += this.kby;
                this.kbx *= 0.88;
                this.kby *= 0.88;
                this.kbTimer--;
            }

            if (this.stunTimer > 0 && this.type !== 'thefirstblueguy') {
                this.stunTimer--;
                return;
            }
            if (this.type === 'wally') {
                if (this.wStandFx > 0) this.wStandFx--;
                if (this.wSit > 0) {
                    // сидит в кресле Мёбиуса: неподвижен и неуязвим
                    this.wSit--;
                    this.wSpin += 0.03;
                    this.wallyHealStep();
                    if (this.wSit === 0) this.wallyStandUp();
                    return;
                }
            }
            if (this.type === 'egor') {
                if (this.wStandFx > 0) this.wStandFx--;
                if (this.wSit > 0) {
                    // сидит в кресле Мёбиуса: неподвижен и неуязвим
                    this.wSit--;
                    this.wSpin += 0.03;
                    if (this.wSit === 0) this.egorStandUp();
                    return;
                }
            }
            // Уолли и Наоя в панике убегают от Чёрного Флэша.
            // Уолли через 30 секунд исчезает из арены, Наоя остаётся внутри.
            if (this.type === 'wally' || this.type === 'naoya') {
                const blackFlash = balls.find(o => o !== this && o.type === 'blackflash' && !o.out && !o.erased && !o.isFakeDead);
                if (blackFlash) {
                    this.blackFlashFleeTimer++;
                    // Убегает от Чёрного Флэша, одновременно заранее обходя стены.
                    // Отталкивание от границ начинается до столкновения, поэтому боец
                    // поворачивает вдоль стены или обратно в арену, а не бьётся о неё.
                    const fleeX = this.x - blackFlash.x;
                    const fleeY = this.y - blackFlash.y;
                    const fleeLen = Math.max(1, Math.hypot(fleeX, fleeY));
                    let steerX = fleeX / fleeLen;
                    let steerY = fleeY / fleeLen;
                    // в бою с Чёрным Флэшем Уолли проходит сквозь стены в большую арену 5000×5000
                    const bigOn = this.type === 'wally' && bigFightOn();
                    const bLo = bigOn ? BIG_LO : 0, bHi = bigOn ? BIG_HI : W;
                    const wallMargin = 105;
                    const wallPush = (distance) => Math.max(0, (wallMargin - distance) / wallMargin);
                    steerX += wallPush(this.x - this.radius - bLo) * 2.8;
                    steerX -= wallPush(bHi - this.radius - this.x) * 2.8;
                    steerY += wallPush(this.y - this.radius - bLo) * 2.8;
                    steerY -= wallPush(bHi - this.radius - this.y) * 2.8;
                    const steerLen = Math.max(0.001, Math.hypot(steerX, steerY));
                    steerX /= steerLen;
                    steerY /= steerLen;
                    if (this.type === 'wally') { this.wallySpeedStep(); this.wallyHealStep(); }
                    const fleeSpeed = this.type === 'wally' ? Math.max(8.5, this.wSpeed) : 6.2;
                    this.dx += (steerX * fleeSpeed - this.dx) * 0.16;
                    this.dy += (steerY * fleeSpeed - this.dy) * 0.16;
                    if (this.type === 'wally') {
                        // отскоки считаются по всему пути, границы — большая арена
                        this.wallyFoldMove(bigOn);
                    } else {
                        let nextX = this.x + this.dx;
                        let nextY = this.y + this.dy;
                        const minX = this.radius + 2, maxX = W - this.radius - 2;
                        const minY = this.radius + 2, maxY = H - this.radius - 2;
                        if (nextX < minX || nextX > maxX) this.dx *= 0.25;
                        if (nextY < minY || nextY > maxY) this.dy *= 0.25;
                        this.x = Math.max(minX, Math.min(maxX, nextX));
                        this.y = Math.max(minY, Math.min(maxY, nextY));
                    }
                    if (this.type === 'wally' && this.blackFlashFleeTimer >= 1800) {
                        this.blackFlashEscaped = true;
                        this.out = true;
                        floatingTexts.push(new FloatingText(this.x, this.y - 34, 'WALLY TELEPORTED OUT OF THE MAP!', '129, 212, 250'));
                        return;
                    }
                    return;
                } else {
                    this.blackFlashFleeTimer = 0;
                }
            }
            if (this.type === 'thefirstblueguy') {
                const speed = 4.2;
                this.x = Math.max(this.radius, Math.min(W - this.radius, this.x + playerMove.x * speed));
                this.y = Math.max(this.radius, Math.min(H - this.radius, this.y + playerMove.y * speed));
                const target = this.nearestEnemy();
                if (target) this.targetAngle = Math.atan2(target.y - this.y, target.x - this.x);
                if (this.playerLaserOn) {
                    this.targets().forEach((t) => { if (this.laserHits(t, 500, 20)) t.dot(0.75, 'firstblue_laser'); });
                }
                return;
            }

            const dist = enemy ? Math.hypot(enemy.x - this.x, enemy.y - this.y) : 9999;
            const self = this;
            const enemySuppressed = balls.some(function (o) {
                return o !== self && !o.out && (o.type === 'antiball' || o.type === 'author') && o.antiActive &&
                    Math.hypot(o.x - self.x, o.y - self.y) <= 80;
            });

            if ((this.type === 'blue' || this.type === 'red') && !enemySuppressed) {
                const laserDuration = this.isUlt ? ULT_FRAMES : 280;
                const cooldownMax = 280;
                const chargeNeed = this.isUlt ? ULT_CHARGE : 90;

                if (this.isUsingAbility) {
                    this.dx = 0;
                    this.dy = 0;
                    if (enemy) this.targetAngle = Math.atan2(enemy.y - this.y, enemy.x - this.x);
                    this.abilityTimer++;
                    if (this.isUlt) {
                        // луч ульты жжёт всех, кого заденет: суммарно до 50 HP
                        const self = this;
                        this.targets().forEach(function (t) {
                            if (self.laserHits(t, ULT_LEN, ULT_WIDTH / 2)) t.dot(ULT_DAMAGE / ULT_FRAMES, 'laser');
                        });
                    } else if (enemy && this.laserHits(enemy)) {
                        enemy.dot(0.15, 'laser');
                    }
                    if (this.abilityTimer >= laserDuration) {
                        this.isUsingAbility = false;
                        this.isUlt = false;
                        this.abilityTimer = 0;
                        this.cooldownTimer = 0;
                        this.randomizeVelocity();
                    }
                } else if (this.isCharging) {
                    this.dx = 0;
                    this.dy = 0;
                    if (enemy) this.targetAngle = Math.atan2(enemy.y - this.y, enemy.x - this.x);
                    this.chargeTimer++;
                    if (this.chargeTimer >= chargeNeed) {
                        this.isCharging = false;
                        this.isUsingAbility = true;
                        this.chargeTimer = 0;
                        this.abilityTimer = 0;
                        playLaserSound();
                        if (this.isUlt) playTimeStopSound();
                    }
                } else {
                    this.x += this.dx;
                    this.y += this.dy;
                    this.cooldownTimer++;
                    this.ultTimer++;
                    if (this.cooldownTimer >= cooldownMax) {
                        this.isCharging = true;
                        this.chargeTimer = 0;
                        if (this.ultTimer >= ULT_EVERY) {
                            this.isUlt = true;
                            this.ultTimer = 0;
                            floatingTexts.push(new FloatingText(this.x, this.y - 34, 'ULT!',
                                this.type === 'red' ? '255, 60, 60' : '90, 175, 255'));
                        }
                    }
                }

            } else if (this.type === 'green' && !enemySuppressed) {
                this.x += this.dx;
                this.y += this.dy;

                this.healTimer++;
                if (this.healTimer >= 360) {
                    this.heal(10);
                    floatingTexts.push(new FloatingText(this.x, this.y, '+10 HP', '120, 255, 120'));
                    this.healTimer = 0;
                }

                this.damageAuraTimer++;
                if (this.damageAuraTimer >= 390) {
                    if (enemy && dist <= 50) enemy.takeDamage(3.5);
                    this.damageAuraTimer = 0;
                }

            } else if (this.type === 'prism' && !enemySuppressed) {
                this.updatePrism(enemy, dist);

            } else if (this.type === 'antiball') {
                if (this.antiActive) {
                    this.dx = 0;
                    this.dy = 0;
                    this.antiTimer++;

                    // печать: «мёртвый» Автор рядом с активным Анти-Шаром не возродится
                    if (enemy && enemy.type === 'author' && enemy.isFakeDead && !enemy.sealed && dist <= 90) {
                        enemy.sealed = true;
                        enemy.isFakeDead = false;
                        enemy.hp = 0;
                        floatingTexts.push(new FloatingText(enemy.x, enemy.y - 30, 'SEALED! NO REVIVAL', '206, 147, 216'));
                    }
                    if (enemy && !enemy.isFakeDead && !enemy.erased) {
                        this.applyAntiField(enemy, dist);
                        if (enemy.type === 'author') this.counterAuthor(enemy, dist);
                    }

                    if (this.antiTimer >= 200) {
                        this.antiActive = false;
                        this.antiTimer = 0;
                        this.antiCooldown = 0;
                        this.randomizeVelocity();
                    }
                } else {
                    this.x += this.dx;
                    this.y += this.dy;
                    this.antiCooldown++;
                    if (this.antiCooldown >= 240) {
                        this.antiActive = true;
                        this.antiTimer = 0;
                        this.dx = 0;
                        this.dy = 0;
                    }
                }

            } else if (this.type === 'oneshot') {
                if (this.ghostTimer > 0) this.ghostTimer--;
                if (this.opFx > 0) this.opFx--;
                if (this.osHopFx > 0) this.osHopFx--;
                if (this.osBurst > 0) this.osBurst--;
                if (this.osSeriesCd > 0) this.osSeriesCd--;
                this.osGhosts.forEach(function (g) { g.life--; });
                this.osGhosts = this.osGhosts.filter(function (g) { return g.life > 0; });

                if (this.opPhase > 0) {
                    this.punchStep(enemy);
                } else if (this.osMove) {
                    this.osMoveStep(enemy);
                } else if (this.strikeTimer > 0) {
                    // замах за спиной врага, затем гарантированный смертельный удар
                    this.dx = 0;
                    this.dy = 0;
                    this.strikeTimer--;
                    if (this.strikeTimer <= 0) {
                        if (enemy && !enemy.isFakeDead) {
                            if (this.osRage && enemy.type === 'cosmic') { enemy.cmFear = true; enemy.cmInvuln = 0; }
                            enemy.takeDamage(this.osRage ? 999 * 1500 : 999, 'oneshot');
                            playExplosionSound();
                        }
                        this.oneShotCooldown = 0;
                        this.randomizeVelocity();
                    }
                } else if (this.isOneShotCharging) {
                    this.dx = 0;
                    this.dy = 0;
                    this.oneShotChargeTimer++;
                    if (this.oneShotChargeTimer >= (this.osRage ? 30 : 90)) {
                        this.isOneShotCharging = false;
                        this.oneShotChargeTimer = 0;
                        if (enemy && !enemy.isFakeDead) {
                            this.teleportBehind(enemy);
                        } else {
                            this.oneShotCooldown = 0;
                            this.randomizeVelocity();
                        }
                    }
                } else {
                    this.x += this.dx * (this.osRage ? 1.6 : 1);
                    this.y += this.dy * (this.osRage ? 1.6 : 1);
                    this.oneShotCooldown++;
                    if (this.oneShotCooldown >= (this.osRage ? 70 : 300)) {
                        const okE = enemy && !enemy.out && !enemy.isFakeDead && !enemy.erased;
                        const roll = Math.random();
                        if (okE && this.osSeriesCd <= 0 && Math.random() < 0.5) {
                            // Killer Move: Serious Series
                            this.osSeries = true;
                            this.osSeriesCd = 1500;
                            this.osQueue = ['hops', 'sneeze', 'punch'];
                            floatingTexts.push(new FloatingText(this.x, this.y - 50, 'KILLER MOVE: SERIOUS SERIES', '255, 60, 60'));
                            playChargeSound(1.5);
                            this.osNext(enemy);
                        } else if (okE && roll < 1 / 6) {
                            this.punchStart(enemy);
                        } else if (okE && roll < 2 / 6) {
                            this.osMove = 'barrage'; this.osT = 0; this.osHits = 0;
                            floatingTexts.push(new FloatingText(this.x, this.y - 34, 'CONSECUTIVE PUNCHES', '255, 80, 80'));
                            playChargeSound(0.4);
                        } else if (okE && roll < 3 / 6) {
                            this.osMove = 'sneeze'; this.osT = 0;
                            floatingTexts.push(new FloatingText(this.x, this.y - 34, 'SERIOUS SNEEZE', '200, 230, 255'));
                            playChargeSound(0.5);
                        } else if (okE && roll < 4 / 6) {
                            this.osMove = 'hops'; this.osT = 0;
                            floatingTexts.push(new FloatingText(this.x, this.y - 34, 'SERIOUS SIDE HOPS', '255, 200, 120'));
                            playChargeSound(0.4);
                        } else if (okE && roll < 5 / 6) {
                            this.osMove = 'omni'; this.osT = 0; this.osRing = [];
                            floatingTexts.push(new FloatingText(this.x, this.y - 34, 'OMNIDIRECTIONAL SERIOUS PUNCH', '255, 120, 120'));
                            playChargeSound(0.8);
                        } else {
                            this.isOneShotCharging = true;
                            this.oneShotChargeTimer = 0;
                        }
                    }
                }

            } else if (this.type === 'scp096') {
                if (this.isRaging) {
                    this.rageStep(enemy, dist);
                } else {
                    this.x += this.dx;
                    this.y += this.dy;
                    this.rageCooldown++;
                    if (this.rageCooldown >= 320) {
                        this.isRaging = true;
                        this.rageTimer = 0;
                        this.comboHitsLeft = 0;
                        playCoughSound();
                        floatingTexts.push(new FloatingText(this.x, this.y - 30, 'RAGE!', '255, 60, 60'));
                    }
                }

            } else if (this.type === 'author') {
                this.updateAuthor(enemy, dist);

            } else if (this.type === 'muha1') {
                // Муха 1: жужжит зигзагами и каждые ~2.5 сек делает рывок-таран (урон + оглушение)
                const tgt = this.nearestEnemy();
                this.m1T = (this.m1T || 0) + 1;
                if (this.m1Dash > 0) {
                    this.m1Dash--;
                    this.x += this.dx; this.y += this.dy;
                    if (tgt && !tgt.out && !tgt.isFakeDead && !tgt.erased && Math.hypot(tgt.x - this.x, tgt.y - this.y) < this.radius + tgt.radius + 4) {
                        tgt.takeDamage(18, 'fly_buzz');
                        if (!tgt.isGodTier()) tgt.stunTimer = Math.max(tgt.stunTimer, 30);
                        floatingTexts.push(new FloatingText(tgt.x, tgt.y - 30, 'BZZT!', '178, 255, 89'));
                        playHitSound();
                        this.m1Dash = 0;
                    }
                } else {
                    const sp = Math.hypot(this.dx, this.dy) || 1;
                    const na = Math.atan2(this.dy, this.dx) + (Math.random() - 0.5) * 0.7;
                    this.dx = Math.cos(na) * 3.6; this.dy = Math.sin(na) * 3.6;
                    this.x += this.dx; this.y += this.dy;
                    if (this.m1T >= 150 && tgt) {
                        this.m1T = 0; this.m1Dash = 28;
                        const a = Math.atan2(tgt.y - this.y, tgt.x - this.x);
                        this.dx = Math.cos(a) * 10; this.dy = Math.sin(a) * 10;
                        floatingTexts.push(new FloatingText(this.x, this.y - 30, 'DASH!', '204, 255, 144'));
                    }
                }

            } else if (this.type === 'muha2' && !enemySuppressed) {
                // Муха 2: катится и каждые 3.5 сек щелкает пальцами — убивает ближайшего
                this.x += this.dx;
                this.y += this.dy;
                this.snapTimer++;
                if (this.snapTimer >= this.snapCooldown) {
                    this.snapTimer = 0;
                    const target = this.nearestEnemy();
                    if (target && !target.out && !target.isFakeDead && !target.erased) {
                        floatingTexts.push(new FloatingText(this.x, this.y - 34, 'SNAP!', '105, 240, 174'));
                        floatingTexts.push(new FloatingText(target.x, target.y - 30, 'KILLED!', '255, 80, 80'));
                        target.takeDamage(9999, 'snap');
                        playExplosionSound();
                    }
                }

            } else if (this.type === 'gojo' && !enemySuppressed) {
                // Годжо: Purple + Domain + RCT
                if (!this.isPurpleCharging) {
                    this.x += this.dx;
                    this.y += this.dy;
                }
                this.gojoPurpleCooldown++;
                this.domainCooldown++;
                this.rctTimer++;

                // Реверсивная техника
                if (this.rctTimer >= 150) {
                    this.rctTimer = 0;
                    if (this.hp < 100) {
                        this.heal(4);
                        floatingTexts.push(new FloatingText(this.x, this.y + 18, 'RCT +', '144, 202, 249'));
                    }
                }

                // Домен (перезарядка 6.5 сек = 390 кадров)
                if (!this.domainActive && this.domainCooldown >= 390) {
                    this.domainActive = true;
                    this.domainTimer = 0;
                    this.domainCooldown = 0;
                    floatingTexts.push(new FloatingText(this.x, this.y - 34, 'DOMAIN: INFINITE VOID', '144, 202, 249'));
                    playTimeStopSound();
                }
                if (this.domainActive) {
                    this.domainTimer++;
                    // домен на всю карту
                    this.targets().forEach(function (t) {
                        if (!t.simpleActive) t.stunTimer = Math.max(t.stunTimer, 4);
                        t.dot(0.22, 'domain_gojo');
                    });
                    if (this.domainTimer >= 120) {
                        this.domainActive = false;
                        this.domainTimer = 0;
                        this.domainCooldown = 0;
                    }
                }

                // Hollow Purple — шар-снаряд
                if (!this.isPurpleCharging && !this.purpleBall && this.gojoPurpleCooldown >= 340) {
                    this.isPurpleCharging = true;
                    this.purpleChargeTimer = 0;
                    this.dx = 0;
                    this.dy = 0;
                    floatingTexts.push(new FloatingText(this.x, this.y - 30, 'Hollow Purple', '186, 104, 200'));
                    playChargeSound(1.2);
                }
                if (this.isPurpleCharging) {
                    this.dx = 0;
                    this.dy = 0;
                    if (enemy) this.targetAngle = Math.atan2(enemy.y - this.y, enemy.x - this.x);
                    this.purpleChargeTimer++;
                    if (this.purpleChargeTimer >= 70) {
                        this.isPurpleCharging = false;
                        this.gojoPurpleCooldown = 0;
                        // запускаем фиолетовый шар
                        const spd = 7.5;
                        this.purpleBall = {
                            x: this.x,
                            y: this.y,
                            dx: Math.cos(this.targetAngle) * spd,
                            dy: Math.sin(this.targetAngle) * spd,
                            r: 18,
                            life: 90,
                            hit: false
                        };
                        playLaserSound();
                        this.randomizeVelocity();
                    }
                }
                // полёт и урон от шара Hollow Purple
                if (this.purpleBall) {
                    const pb = this.purpleBall;
                    pb.x += pb.dx;
                    pb.y += pb.dy;
                    pb.life--;
                    // лёгкое наведение на ближайшего врага
                    const tg = this.nearestEnemy();
                    if (tg && !pb.hit) {
                        const ang = Math.atan2(tg.y - pb.y, tg.x - pb.x);
                        pb.dx = pb.dx * 0.92 + Math.cos(ang) * 0.9;
                        pb.dy = pb.dy * 0.92 + Math.sin(ang) * 0.9;
                    }
                    // попадание
                    if (!pb.hit) {
                        this.targets().forEach(function (t) {
                            if (pb.hit) return;
                            if (Math.hypot(t.x - pb.x, t.y - pb.y) <= t.radius + pb.r) {
                                pb.hit = true;
                                t.takeDamage(40, 'purple');
                                t.stunTimer = Math.max(t.stunTimer, 50);
                                t.kbx = pb.dx * 0.8;
                                t.kby = pb.dy * 0.8;
                                t.kbTimer = 20;
                                floatingTexts.push(new FloatingText(t.x, t.y - 28, 'PURPLE!', '224, 64, 251'));
                                playExplosionSound();
                            }
                        });
                    }
                    // выход за карту или конец жизни
                    if (pb.life <= 0 || pb.x < -40 || pb.x > W + 40 || pb.y < -40 || pb.y > H + 40 || pb.hit) {
                        if (pb.hit || pb.life <= 0) {
                            // небольшой взрыв в точке
                            playExplosionSound();
                        }
                        this.purpleBall = null;
                    }
                }

            } else if (this.type === 'sukuna' && !enemySuppressed) {
                // Сукуна / Мегуна: Cleave + Domain + RCT (+ силы Мегуми у Мегуны)
                this.x += this.dx;
                this.y += this.dy;
                this.cleaveTimer++;
                this.domainCooldown = (this.domainCooldown || 0) + 1;
                this.rctTimer++;
                if (this.isMeguna) {
                    this.shadowTimer = (this.shadowTimer || 0) + 1;
                    this.mahoragaTimer = (this.mahoragaTimer || 0) + 1;
                }

                // Реверсивная техника (у Мегуны сильнее)
                if (this.rctTimer >= (this.isMeguna ? 130 : 160)) {
                    this.rctTimer = 0;
                    const maxHp = this.isMeguna ? 150 : 100;
                    if (this.hp < maxHp) {
                        this.heal(this.isMeguna ? 5.5 : 3.5);
                        floatingTexts.push(new FloatingText(this.x, this.y + 18, 'RCT +', '255, 120, 120'));
                    }
                }

                // Malevolent Shrine — на всю карту, КД 6.5 сек
                if (!this.domainSukunaActive && this.domainCooldown >= 390) {
                    this.domainSukunaActive = true;
                    this.domainSukunaTimer = 0;
                    this.domainCooldown = 0;
                    floatingTexts.push(new FloatingText(this.x, this.y - 34,
                        this.isMeguna ? 'DOMAIN: MEGUNA' : 'DOMAIN: MALEVOLENT SHRINE', '255, 80, 80'));
                    playCoughSound();
                }
                if (this.domainSukunaActive) {
                    this.domainSukunaTimer++;
                    // Гарантированное попадание — урон всем, игнорирует уклонение и Бесконечность
                    const dmg = this.isMeguna ? 0.65 : 0.55;
                    this.targets().forEach(function (t) {
                        t.sureHit(dmg, 'domain_sukuna');
                    });
                    if (this.domainSukunaTimer >= (this.isMeguna ? 150 : 130)) {
                        this.domainSukunaActive = false;
                        this.domainSukunaTimer = 0;
                        this.domainCooldown = 0;
                    }
                }

                // Cleave / Dismantle (у Мегуны сильнее)
                if (this.cleaveTimer >= (this.isMeguna ? 110 : 140)) {
                    this.cleaveTimer = 0;
                    if (enemy && dist < 250) {
                        floatingTexts.push(new FloatingText(enemy.x, enemy.y - 28, 'DISMANTLE!', '255, 120, 120'));
                        enemy.takeDamage(this.isMeguna ? 18 : 14, 'cleave');
                        playHitSound();
                    }
                }

                // ===== Силы Мегуми у Мегуны =====
                if (this.isMeguna) {
                    // Теневые клинки
                    if (this.shadowTimer >= 140) {
                        this.shadowTimer = 0;
                        if (enemy && dist < 200) {
                            floatingTexts.push(new FloatingText(enemy.x, enemy.y - 22, 'SHADOW!', '120, 144, 156'));
                            enemy.takeDamage(9, 'shadow');
                        }
                    }
                    // Призыв Махораги
                    if (!this.mahoragaActive && this.mahoragaTimer >= 380) {
                        const existing = balls.find(function (b) { return b.type === 'mahoraga' && !b.out; });
                        if (!existing) {
                            this.mahoragaActive = true;
                            this.mahoragaTimer = 0;
                            const mx = Math.max(30, Math.min(W - 30, this.x + (Math.random() - 0.5) * 80));
                            const my = Math.max(30, Math.min(H - 30, this.y + (Math.random() - 0.5) * 80));
                            const maha = new Ball(mx, my, '#b0bec5', 'mahoraga', 'Mahoraga', 'Mahoraga');
                            maha.owner = this;
                            maha.team = this.team;
                            maha.hp = 200;
                            maha.adaptation = 0;
                            balls.push(maha);
                            this.mahoragaBall = maha;
                            floatingTexts.push(new FloatingText(this.x, this.y - 34, 'SUMMON: MAHORAGA!', '176, 190, 197'));
                            playTimeStopSound();
                        }
                    }
                    if (this.mahoragaBall && (this.mahoragaBall.out || this.mahoragaBall.hp <= 0)) {
                        this.mahoragaActive = false;
                        this.mahoragaBall = null;
                    }
                }

            } else if (this.type === 'megumi' && !enemySuppressed) {
                // Мегуми: тени + Махорага + RCT
                this.x += this.dx;
                this.y += this.dy;
                this.shadowTimer++;
                this.mahoragaTimer++;
                this.rctTimer++;

                // Реверсивная техника
                if (this.rctTimer >= 170) {
                    this.rctTimer = 0;
                    if (this.hp < 100) {
                        this.heal(3);
                        floatingTexts.push(new FloatingText(this.x, this.y + 18, 'RCT +', '120, 144, 156'));
                    }
                }

                // Призыв настоящего Махораги (200 HP + адаптация)
                if (!this.mahoragaActive && this.mahoragaTimer >= 420) {
                    // проверяем, нет ли уже живого Махораги
                    const existing = balls.find(function (b) { return b.type === 'mahoraga' && !b.out; });
                    if (!existing) {
                        this.mahoragaActive = true;
                        this.mahoragaTimer = 0;
                        const mx = Math.max(30, Math.min(W - 30, this.x + (Math.random() - 0.5) * 80));
                        const my = Math.max(30, Math.min(H - 30, this.y + (Math.random() - 0.5) * 80));
                        const maha = new Ball(mx, my, '#b0bec5', 'mahoraga', 'Mahoraga', 'Mahoraga');
                        maha.owner = this;
                        maha.team = this.team;
                        maha.hp = 200;
                        maha.adaptation = 0;
                        balls.push(maha);
                        this.mahoragaBall = maha;
                        floatingTexts.push(new FloatingText(this.x, this.y - 34, 'SUMMON: MAHORAGA!', '176, 190, 197'));
                        playTimeStopSound();
                    }
                }
                // если Махорага умер — можно призвать снова позже
                if (this.mahoragaBall && (this.mahoragaBall.out || this.mahoragaBall.hp <= 0)) {
                    this.mahoragaActive = false;
                    this.mahoragaBall = null;
                }

                // теневые клинки
                if (this.shadowTimer >= 160) {
                    this.shadowTimer = 0;
                    if (enemy && dist < 190) {
                        floatingTexts.push(new FloatingText(enemy.x, enemy.y - 22, 'SHADOW!', '120, 144, 156'));
                        enemy.takeDamage(8, 'shadow');
                    }
                }

            } else if (this.type === 'mahoraga' && !enemySuppressed) {
                // Махорага: адаптация + сильные удары
                this.x += this.dx;
                this.y += this.dy;
                this.adaptation = Math.min(7, this.adaptation + 0.004); // постепенно адаптируется
                if (enemy) {
                    const angle = Math.atan2(enemy.y - this.y, enemy.x - this.x);
                    this.dx = Math.cos(angle) * 2.8;
                    this.dy = Math.sin(angle) * 2.8;
                    if (dist <= this.radius + enemy.radius + 6) {
                        if (Math.random() < 0.08) {
                            enemy.takeDamage(11, 'contact');
                            playHitSound();
                            floatingTexts.push(new FloatingText(enemy.x, enemy.y - 20, 'HIT', '176, 190, 197'));
                        }
                    }
                }
                // лёгкий RCT-эффект адаптации
                if (this.hp < 200 && Math.random() < 0.02) {
                    this.heal(0.8);
                }

            } else if (this.type === 'ryu' && !enemySuppressed) {
                // Рю Ишигори — Гранитный выстрел
                this.graniteCooldown++;
                this.rctTimer++;
                if (this.rctTimer >= 180) {
                    this.rctTimer = 0;
                    if (this.hp < 100) {
                        this.heal(2.5);
                        floatingTexts.push(new FloatingText(this.x, this.y + 18, 'RCT +', '255, 204, 128'));
                    }
                }
                if (this.graniteBeam) {
                    this.dx = 0;
                    this.dy = 0;
                    if (enemy) this.targetAngle = Math.atan2(enemy.y - this.y, enemy.x - this.x);
                    this.graniteBeamTimer++;
                    this.targets().forEach(function (t) {
                        if (self.laserHits(t, 280, 20)) t.dot(0.28, 'granite');
                    });
                    if (this.graniteBeamTimer >= 100) {
                        this.graniteBeam = false;
                        this.graniteBeamTimer = 0;
                        this.graniteCooldown = 0;
                        this.randomizeVelocity();
                    }
                } else {
                    this.x += this.dx;
                    this.y += this.dy;
                    if (this.graniteCooldown >= 260 && this.targets().length > 0) {
                        this.graniteBeam = true;
                        this.graniteBeamTimer = 0;
                        this.beamPower = 1.15;
                        if (enemy) this.targetAngle = Math.atan2(enemy.y - this.y, enemy.x - this.x);
                        floatingTexts.push(new FloatingText(this.x, this.y - 32, 'GRANITE BLAST!', '255, 204, 128'));
                        playChargeSound(0.8);
                        playLaserSound();
                    }
                }

            } else if (this.type === 'yuta' && !enemySuppressed) {
                // Юта Оккоцу — копирование + луч проклятой энергии
                this.yutaBeamCooldown++;
                this.copyTimer++;
                this.rctTimer++;
                // УЛЬТА: «Рика» — полное воплощение при HP < 50 (один раз за бой)
                if (!this.yUltUsed && this.hp > 0 && this.hp < 50) {
                    this.yUltUsed = true; this.yUltT = 600;
                    this.heal(20);
                    this.yutaBeamCooldown = 999;   // сразу мощный луч
                    floatingTexts.push(new FloatingText(this.x, this.y - 46, 'ULT: RIKA — FULL MANIFESTATION!', '255, 105, 190'));
                    playChargeSound(1);
                }
                const ult = this.yUltT > 0;
                if (ult) {
                    this.yUltT--;
                    if (this.hp < 100 && this.yUltT % 60 === 0) this.heal(5);
                }
                // меч (катана): удар в ближнем бою; в ульте чаще и сильнее
                this.ySwordCd--;
                if (this.ySwingT > 0) this.ySwingT--;
                if (enemy && !this.yutaBeam && this.ySwordCd <= 0 && dist < this.radius + enemy.radius + 48) {
                    this.ySwingAng = Math.atan2(enemy.y - this.y, enemy.x - this.x);
                    this.ySwingT = 14;
                    this.ySwordCd = ult ? 22 : 55;
                    enemy.takeDamage(ult ? 14 : 6, 'other');
                    floatingTexts.push(new FloatingText(enemy.x, enemy.y - 24, ult ? 'RIKA SLASH' : 'SLASH', '200, 220, 255'));
                    playHitSound();
                }
                if (this.rctTimer >= 150) {
                    this.rctTimer = 0;
                    if (this.hp < 100) {
                        this.heal(3.5);
                        floatingTexts.push(new FloatingText(this.x, this.y + 18, 'RCT +', '144, 164, 255'));
                    }
                }

                // Копирование: раз в ~4 сек может применить скопированный приём (слабее + искажение)
                if (this.copiedSkill && this.copyUses > 0 && this.copyTimer >= 240 && !this.yutaBeam) {
                    this.copyTimer = 0;
                    this.copyUses--;
                    const skill = this.copiedSkill;
                    floatingTexts.push(new FloatingText(this.x, this.y - 34, 'COPY: ' + skill + ' (distorted)', '144, 164, 255'));
                    playLaserSound();
                    if (skill === 'granite' || skill === 'laser' || skill === 'purple') {
                        // искажённый луч — чуть слабее оригинала
                        this.yutaBeam = true;
                        this.yutaBeamTimer = 0;
                        this.beamPower = 0.8; // капельку хуже
                        if (enemy) this.targetAngle = Math.atan2(enemy.y - this.y, enemy.x - this.x);
                    } else if (skill === 'cleave' && enemy) {
                        enemy.takeDamage(11, 'shadow'); // слабее рассечения
                        playHitSound();
                    } else if (skill === 'snap' && enemy) {
                        enemy.takeDamage(35, 'other'); // сильно слабее щелчка
                        playExplosionSound();
                    } else if (enemy) {
                        enemy.takeDamage(10, 'other');
                    }
                    if (this.copyUses <= 0) {
                        floatingTexts.push(new FloatingText(this.x, this.y - 20, 'copy expired', '120, 144, 200'));
                        this.copiedSkill = null;
                    }
                }

                if (this.yutaBeam) {
                    this.dx = 0;
                    this.dy = 0;
                    if (enemy) {
                        // лёгкое «искривление» угла — луч чуть дрожит
                        const base = Math.atan2(enemy.y - this.y, enemy.x - this.x);
                        this.targetAngle = base + Math.sin(this.yutaBeamTimer * 0.25) * 0.08;
                    }
                    this.yutaBeamTimer++;
                    const dmg = 0.2 * (this.beamPower || 0.85);
                    this.targets().forEach(function (t) {
                        if (self.laserHits(t, 260, 16)) t.dot(dmg, 'yuta_beam');
                    });
                    if (this.yutaBeamTimer >= 90) {
                        this.yutaBeam = false;
                        this.yutaBeamTimer = 0;
                        this.yutaBeamCooldown = 0;
                        this.randomizeVelocity();
                    }
                } else {
                    // с мечом тянется к противнику, когда клинок готов
                    if (enemy && dist < 170 && this.ySwordCd <= 8) {
                        const sp = Math.hypot(this.dx, this.dy) || 3.5;
                        const ang = Math.atan2(enemy.y - this.y, enemy.x - this.x);
                        this.dx = this.dx * 0.8 + Math.cos(ang) * sp * 0.2;
                        this.dy = this.dy * 0.8 + Math.sin(ang) * sp * 0.2;
                    }
                    this.x += this.dx * (ult ? 1.25 : 1);
                    this.y += this.dy * (ult ? 1.25 : 1);
                    // свой луч проклятой энергии
                    if (this.yutaBeamCooldown >= (ult ? 150 : 300) && this.targets().length > 0) {
                        this.yutaBeam = true;
                        this.yutaBeamTimer = 0;
                        this.beamPower = ult ? 1.3 : 0.95;
                        if (enemy) this.targetAngle = Math.atan2(enemy.y - this.y, enemy.x - this.x);
                        floatingTexts.push(new FloatingText(this.x, this.y - 32, 'RIKA: BEAM!', '144, 164, 255'));
                        playLaserSound();
                    }
                }

            } else if (this.type === 'todo' && !enemySuppressed) {
                this.updateTodo(enemy, dist);

            } else if (this.type === 'goku' && !enemySuppressed) {
                this.updateGoku(enemy, dist);

            } else if (this.type === 'vegeta' && !enemySuppressed) {
                this.updateVegeta(enemy, dist);

            } else if (this.type === 'gblack' && !enemySuppressed) {
                this.updateGblack(enemy, dist);

            } else if (this.type === 'yuji' && !enemySuppressed) {
                this.updateYuji(enemy, dist);

            } else if (this.type === 'naoya' && !enemySuppressed) {
                this.updateNaoya(enemy, dist);

            } else if (this.type === 'timegod' && !enemySuppressed) {
                this.updateTimeGod(enemy, dist);

            } else if (this.type === 'blackflash' && !enemySuppressed) {
                this.updateBlackFlash(enemy, dist);

            } else if (this.type === 'wally' && !enemySuppressed) {
                this.updateWally(enemy, dist);

            } else if (this.type === 'egor' && !enemySuppressed) {
                this.updateEgor(enemy, dist);

            } else if (this.type === 'doubling' && !enemySuppressed) {
                this.updateDoubling(enemy, dist);

            } else if (this.type === 'cosmic' && !enemySuppressed) {
                this.updateCosmic(enemy, dist);

            } else if (this.type === 'robot' && !enemySuppressed) {
                this.updateRobot(enemy, dist);

            } else if (this.type === 'cloner') {
                this.updateCloner(enemy, dist);

            } else {
                // способности подавлены Анти-Шаром — просто катимся
                if (this.type === 'naoya' && this.naoyaPhase) this.resetNaoya();
                if (this.type === 'timegod' && (this.tgPhase || this.zoneT > 0)) this.resetTimeGod();
                if (this.type === 'wally' && this.wPhase) this.resetWally();
                if (this.type === 'egor' && this.egPhase === 'verse') { this.egPhase = ''; this.egTimer = 0; }
                if (this.type === 'prism') this.resetPrism();
                this.x += this.dx;
                this.y += this.dy;
            }
        }
    }

    /* ---------------- СТОЛКНОВЕНИЕ ЛАЗЕРОВ ---------------- */
    // Виды взрыва при столкновении лучей
    const BLAST_KINDS = {
        // обычное столкновение двух лучей
        normal: { id: 'normal', chance: 0.35, damage: 50, frames: 80, scale: 1,
                  label: 'LASER BLAST!', chargeText: 'CHARGING ENERGY...',
                  outer: '255, 120, 0', mid: '255, 200, 60', wave: '255, 140, 0' },
        // две ульты (лучи Красного/Синего в режиме ульты)
        ult: { id: 'ult', chance: 0.75, damage: 75, frames: 120, scale: 1.5,
               label: 'GIANT BLAST!', chargeText: 'CRITICAL ENERGY BUILD-UP!',
               outer: '230, 30, 30', mid: '255, 160, 60', wave: '255, 60, 60' },
        // три луча столкнулись одновременно
        triple: { id: 'triple', chance: 1.0, damage: 60, frames: 100, scale: 1.25,
                  label: 'TRIPLE BLAST!', chargeText: 'TRIPLE ENERGY BUILD-UP!',
                  outer: '170, 70, 255', mid: '255, 215, 90', wave: '200, 120, 255' }
    };

    // луч «включён» у синего, красного и у Автора с лазером
    function laserOn(b) {
        if (b.out || b.isFakeDead || b.erased) return false;
        if (b.isUsingAbility && (b.type === 'blue' || b.type === 'red')) return true;
        if (b.type === 'prism') return b.beamOn || b.focusPhase === 'beam';
        if (b.type === 'ryu' && b.graniteBeam) return true;
        if (b.type === 'yuta' && b.yutaBeam) return true;
        return b.type === 'author' && b.skill === 'laser' && b.skillPhase === 'active';
    }

    // луч в режиме ульты (только Красный / Синий)
    function laserIsUlt(b) {
        return (b.type === 'blue' || b.type === 'red') && b.isUsingAbility && b.isUlt;
    }

    function laserLen(b) {
        if (laserIsUlt(b)) return ULT_LEN;
        if (b.type === 'ryu') return 280;
        if (b.type === 'yuta') return 260;
        return b.type === 'prism' ? (b.focusPhase === 'beam' ? 520 : 320) : 150;
    }

    function laserWidth(b) {
        if (laserIsUlt(b)) return ULT_WIDTH;
        if (b.type === 'ryu') return 40;
        if (b.type === 'yuta') return 32;
        return b.type === 'prism' ? (b.focusPhase === 'beam' ? 14 : 8) : 35;
    }

    function laserSeg(b) {
        const len = laserLen(b);
        return {
            x1: b.x, y1: b.y,
            x2: b.x + Math.cos(b.targetAngle) * len,
            y2: b.y + Math.sin(b.targetAngle) * len
        };
    }

    function pointSegDist(px, py, ax, ay, bx, by) {
        const vx = bx - ax, vy = by - ay;
        const len2 = vx * vx + vy * vy;
        let t = len2 ? ((px - ax) * vx + (py - ay) * vy) / len2 : 0;
        t = Math.max(0, Math.min(1, t));
        return Math.hypot(px - (ax + vx * t), py - (ay + vy * t));
    }

    function segIntersect(a, b) {
        const d = (b.y2 - b.y1) * (a.x2 - a.x1) - (b.x2 - b.x1) * (a.y2 - a.y1);
        if (d === 0) return false;
        const ua = ((b.x2 - b.x1) * (a.y1 - b.y1) - (b.y2 - b.y1) * (a.x1 - b.x1)) / d;
        const ub = ((a.x2 - a.x1) * (a.y1 - b.y1) - (a.y2 - a.y1) * (a.x1 - b.x1)) / d;
        return ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1;
    }

    function segDist(a, b) {
        if (segIntersect(a, b)) return 0;
        return Math.min(
            pointSegDist(a.x1, a.y1, b.x1, b.y1, b.x2, b.y2),
            pointSegDist(a.x2, a.y2, b.x1, b.y1, b.x2, b.y2),
            pointSegDist(b.x1, b.y1, a.x1, a.y1, a.x2, a.y2),
            pointSegDist(b.x2, b.y2, a.x1, a.y1, a.x2, a.y2)
        );
    }

    function startBlastCharge(list, kind, x, y) {
        blastKind = kind;
        blastChargeMax = kind.frames;
        blastCharge = kind.frames;
        blastBalls = list;
        blastX = x;
        blastY = y;
        playChargeSound(kind.frames / 60);
        floatingTexts.push(new FloatingText(x, y - 34, kind.chargeText, kind.wave));
    }

    function laserBlast(x, y) {
        const kind = blastKind || BLAST_KINDS.normal;
        blastTimer = 40;
        blastX = x;
        blastY = y;
        playExplosionSound();
        floatingTexts.push(new FloatingText(W / 2, H / 2, kind.label + ' -' + kind.damage + ' HP', kind.wave));
        balls.forEach(function (b) {
            if (b.out || b.isFakeDead || b.erased) return;
            // взрыв гасит столкнувшиеся лучи
            if (blastBalls.indexOf(b) !== -1) {
                if (b.type === 'author') {
                    b.cancelAuthorSkill();
                } else if (b.type === 'prism') {
                    b.resetPrism();
                } else {
                    b.isUsingAbility = false;
                    b.isUlt = false;
                    b.isCharging = false;
                    b.chargeTimer = 0;
                    b.abilityTimer = 0;
                    b.cooldownTimer = 0;
                    b.randomizeVelocity();
                }
            }
            b.stunTimer = Math.max(b.stunTimer, 45);
            b.takeDamage(kind.damage);
        });
        blastBalls = [];
    }

    function rollClash(list, kind, x, y) {
        if (Math.random() < kind.chance) {
            startBlastCharge(list, kind, x, y);
        } else {
            floatingTexts.push(new FloatingText(x, y - 20, 'BEAMS CLASHED', '255, 255, 255'));
        }
    }

    // Столкновения лучей: кубик кидается один раз за каждое столкновение.
    //   два обычных луча        → 35%, взрыв 50 HP
    //   две ульты               → 75%, взрыв 75 HP
    //   три луча одновременно   → взрыв 60 HP
    function checkLaserClash() {
        if (timeStopOwner) return;
        const n = balls.length;
        const clashing = {};
        for (let i = 0; i < n; i++) {
            for (let j = i + 1; j < n; j++) {
                const a = balls[i], b = balls[j];
                clashing[i + '-' + j] = laserOn(a) && laserOn(b) &&
                    segDist(laserSeg(a), laserSeg(b)) <= (laserWidth(a) + laserWidth(b)) / 2;
            }
        }

        // тройное столкновение: пересеклись все три пары
        const triple = n === 3 && clashing['0-1'] && clashing['0-2'] && clashing['1-2'];
        if (triple && !clashRolled.tri && blastCharge <= 0) {
            clashRolled.tri = true;
            clashRolled['0-1'] = clashRolled['0-2'] = clashRolled['1-2'] = true;
            const cx = (balls[0].x + balls[1].x + balls[2].x) / 3;
            const cy = (balls[0].y + balls[1].y + balls[2].y) / 3;
            rollClash(balls.slice(), BLAST_KINDS.triple, cx, cy);
        }
        if (!triple) clashRolled.tri = false;

        for (let i = 0; i < n; i++) {
            for (let j = i + 1; j < n; j++) {
                const key = i + '-' + j;
                if (clashing[key] && !clashRolled[key] && blastCharge <= 0) {
                    clashRolled[key] = true;
                    const a = balls[i], b = balls[j];
                    if (isTeamMode() && a.team !== undefined && a.team === b.team) continue;
                    // Битва лучей: Рю vs Юта (или любые два «тяжёлых» луча jjk)
                    const beamFight = (a.type === 'ryu' || a.type === 'yuta') && (b.type === 'ryu' || b.type === 'yuta');
                    if (beamFight) {
                        const pa = a.beamPower || 1;
                        const pb = b.beamPower || 1;
                        const cx = (a.x + b.x) / 2;
                        const cy = (a.y + b.y) / 2;
                        floatingTexts.push(new FloatingText(cx, cy - 40, 'BEAM CLASH!', '255, 255, 255'));
                        playChargeSound(1.0);
                        // сильнее луч побеждает
                        if (pa > pb + 0.05) {
                            floatingTexts.push(new FloatingText(cx, cy - 18, a.name + ' OVERPOWERED!', '255, 220, 150'));
                            b.takeDamage(28, a.type === 'ryu' ? 'granite' : 'yuta_beam');
                            b.stunTimer = Math.max(b.stunTimer, 50);
                            if (b.type === 'ryu') { b.graniteBeam = false; b.graniteBeamTimer = 0; b.graniteCooldown = 0; }
                            if (b.type === 'yuta') { b.yutaBeam = false; b.yutaBeamTimer = 0; b.yutaBeamCooldown = 0; }
                            b.randomizeVelocity();
                        } else if (pb > pa + 0.05) {
                            floatingTexts.push(new FloatingText(cx, cy - 18, b.name + ' OVERPOWERED!', '255, 220, 150'));
                            a.takeDamage(28, b.type === 'ryu' ? 'granite' : 'yuta_beam');
                            a.stunTimer = Math.max(a.stunTimer, 50);
                            if (a.type === 'ryu') { a.graniteBeam = false; a.graniteBeamTimer = 0; a.graniteCooldown = 0; }
                            if (a.type === 'yuta') { a.yutaBeam = false; a.yutaBeamTimer = 0; a.yutaBeamCooldown = 0; }
                            a.randomizeVelocity();
                        } else {
                            // равная сила — взрыв
                            rollClash([a, b], BLAST_KINDS.ult, cx, cy);
                        }
                    } else {
                        const kind = (laserIsUlt(a) && laserIsUlt(b)) ? BLAST_KINDS.ult : BLAST_KINDS.normal;
                        rollClash([a, b], kind, (a.x + b.x) / 2, (a.y + b.y) / 2);
                    }
                }
                if (!clashing[key]) clashRolled[key] = false;
            }
        }
    }

    /* ---------------- ФИЗИКА ---------------- */
    // бой Уолли с Чёрным Флэшем: открывается большая арена 5000×5000
    function bigFightOn() {
        let w = false, k = false;
        for (let i = 0; i < balls.length; i++) {
            const b = balls[i];
            if (b.out || b.erased) continue;
            if (b.type === 'wally') w = true;
            else if (b.type === 'blackflash' || b.type === 'egor') k = true;
        }
        return w && k;
    }

    function doublingFmt(n) {
        return n < 1e6 ? String(n) : n.toExponential(1).replace('e+', 'e');
    }

    // границы мира шара (по обеим осям); null — обычная арена 500×500
    function worldBounds(b) {
        if (b.type === 'egor' && b.egTrueUsed) { const lo = -(EGOR_WORLD - W) / 2; return [lo, lo + EGOR_WORLD]; }
        if ((b.type === 'wally' || b.type === 'blackflash' || b.type === 'egor') && bigFightOn()) return [BIG_LO, BIG_HI];
        return null;
    }

    // кто сейчас вправе выходить за арену (для карты)
    function worldActors() {
        const res = [];
        balls.forEach(function (b) {
            if (!b.out && !b.erased && worldBounds(b)) res.push(b);
        });
        return res;
    }

    function recordBigTrail() {
        const act = worldActors();
        balls.forEach(function (b) { if (act.indexOf(b) < 0) b.bigTrail = null; });
        act.forEach(function (b) {
            if (!b.bigTrail) b.bigTrail = [];
            b.bigTrail.push([b.x, b.y]);
            if (b.bigTrail.length > 45) b.bigTrail.shift();
        });
    }

    function wallBounce(b) {
        const wbn = worldBounds(b);
        if (wbn) {
            const lo = wbn[0] + b.radius, hi = wbn[1] - b.radius;
            if (b.x < lo) { b.x = lo; b.dx = Math.abs(b.dx); }
            if (b.x > hi) { b.x = hi; b.dx = -Math.abs(b.dx); }
            if (b.y < lo) { b.y = lo; b.dy = Math.abs(b.dy); }
            if (b.y > hi) { b.y = hi; b.dy = -Math.abs(b.dy); }
            return;
        }
        if (b.x - b.radius < 0) { b.x = b.radius; b.dx = Math.abs(b.dx); }
        if (b.x + b.radius > W) { b.x = W - b.radius; b.dx = -Math.abs(b.dx); }
        if (b.y - b.radius < 0) { b.y = b.radius; b.dy = Math.abs(b.dy); }
        if (b.y + b.radius > H) { b.y = H - b.radius; b.dy = -Math.abs(b.dy); }
    }

    function collide() {
        const touching = [];
        for (let i = 0; i < balls.length; i++) {
            for (let j = i + 1; j < balls.length; j++) {
                const a = balls[i], b = balls[j];
                if (a.out || b.out || a.isFakeDead || b.isFakeDead || a.erased || b.erased) continue;
                const ddx = b.x - a.x, ddy = b.y - a.y;
                const d = Math.hypot(ddx, ddy);
                const minDist = a.radius + b.radius;
                if (d < minDist && d > 0) {
                    const nx = ddx / d, ny = ddy / d;
                    const overlap = minDist - d;
                    a.x -= nx * overlap / 2;
                    a.y -= ny * overlap / 2;
                    b.x += nx * overlap / 2;
                    b.y += ny * overlap / 2;

                    const rel = (a.dx - b.dx) * nx + (a.dy - b.dy) * ny;
                    if (rel > 0) {
                        a.dx -= rel * nx; a.dy -= rel * ny;
                        b.dx += rel * nx; b.dy += rel * ny;
                    }
                    touching.push([a, b]);
                }
            }
        }
        // небольшой урон от столкновения, чтобы бой всегда заканчивался
        if (touching.length && !timeStopOwner && contactCooldown <= 0) {
            touching.forEach(function (p) {
                if ((isTeamMode() || p[0].cloneGroup || isPact(p[0], p[1])) && p[0].isAlly(p[1])) return;
                p[0].takeDamage(1, 'contact'); p[1].takeDamage(1, 'contact');
            });
            contactCooldown = 40;
        }
    }

    /* ---------------- СТОЛКНОВЕНИЕ ДОМЕНОВ ---------------- */
    const DOMAIN_CLASH_FRAMES = 150;   // 2,5 секунды борьбы
    const DOMAIN_BREAK_DAMAGE = 30;    // урон проигравшему
    const DOMAIN_COUNTER_CHANCE = 0.55; // шанс ответить доменом на чужой домен
    const DOMAIN_COUNTER_MIN_CD = 200; // перезарядка должна накопиться хотя бы до этого

    function isDomainOwner(b) { return b.type === 'gojo' || b.type === 'sukuna'; }
    function domainFlag(b) {
        return !b.out && ((b.type === 'gojo' && b.domainActive) || (b.type === 'sukuna' && b.domainSukunaActive));
    }
    function domainEnd(b) {
        if (b.type === 'gojo') { b.domainActive = false; b.domainTimer = 0; }
        else { b.domainSukunaActive = false; b.domainSukunaTimer = 0; }
        b.domainCooldown = 0;
    }
    function domainStart(b) {
        if (b.type === 'gojo') { b.domainActive = true; b.domainTimer = 0; }
        else { b.domainSukunaActive = true; b.domainSukunaTimer = 0; }
        b.domainCooldown = 0;
    }
    function domainKindOf(b) { return b.type === 'gojo' ? 'void' : (b.isMeguna ? 'meguna' : 'shrine'); }
    function domainColor(b) { const k = domainKindOf(b); return k === 'void' ? '100, 181, 246' : (k === 'meguna' ? '255, 64, 129' : '255, 82, 82'); }
    function domainName(b) {
        const k = domainKindOf(b);
        return k === 'void' ? 'INFINITE VOID' : (k === 'meguna' ? 'MEGUNA DOMAIN' : 'MALEVOLENT SHRINE');
    }
    // сила домена в борьбе: больше здоровья — сильнее; у Мегуны бонус
    function domainPower(b) {
        const maxHp = b.isMeguna ? 150 : 100;
        return (0.75 + 0.5 * Math.max(0, Math.min(1, b.hp / maxHp))) * (b.isMeguna ? 1.25 : 1);
    }

    function startDomainClash(a, b) {
        domainClash = { a: a, b: b, t: 0, bar: 0.5 };
        [a, b].forEach(function (x) { x.stunTimer = Math.max(x.stunTimer, 3); x.dx = 0; x.dy = 0; });
        floatingTexts.push(new FloatingText(W / 2, H / 2 - 50, 'DOMAIN CLASH!', '255, 255, 255'));
        playExplosionSound();
        playTimeStopSound();
    }

    function finishDomainClash(abort) {
        const c = domainClash;
        domainClash = null;
        if (!c) return;
        [c.a, c.b].forEach(function (x) { if (x.stunTimer <= 3) x.stunTimer = 0; });
        if (abort) return;

        const winner = c.bar >= 0.5 ? c.a : c.b;
        const loser = winner === c.a ? c.b : c.a;
        // домен проигравшего рушится
        domainEnd(loser);
        loser.sureHit(DOMAIN_BREAK_DAMAGE, 'domain_clash');
        floatingTexts.push(new FloatingText(loser.x, loser.y, '-' + DOMAIN_BREAK_DAMAGE + ' HP'));
        loser.stunTimer = Math.max(loser.stunTimer, 90);
        floatingTexts.push(new FloatingText(loser.x, loser.y - 34, 'DOMAIN BROKEN!', '255, 120, 120'));
        // домен победителя продолжается и становится длиннее на 40 кадров
        if (winner.type === 'gojo') winner.domainTimer = Math.max(0, winner.domainTimer - 40);
        else winner.domainSukunaTimer = Math.max(0, winner.domainSukunaTimer - 40);
        floatingTexts.push(new FloatingText(winner.x, winner.y - 34, 'DOMAIN HELD!', '255, 234, 0'));
        clashFlash = 40;
        clashFlashX = loser.x;
        clashFlashY = loser.y;
        clashFlashColor = domainColor(winner);
        playExplosionSound();
    }

    function stepDomainClash() {
        if (clashFlash > 0) clashFlash--;
        if (timeStopOwner) return;

        balls.forEach(function (b) { if (!domainFlag(b)) b.counterRolled = false; });

        if (!domainClash) {
            const owners = balls.filter(domainFlag);

            // ответный домен: у соперника (Годжо / Сукуна) может хватить сил раскрыть свой
            owners.forEach(function (o) {
                if (o.counterRolled) return;
                o.counterRolled = true;
                const rival = balls.find(function (r) {
                    return r !== o && !r.out && !r.erased && !r.isFakeDead && isDomainOwner(r) && !o.isAlly(r) &&
                        !domainFlag(r) && (r.domainCooldown || 0) >= DOMAIN_COUNTER_MIN_CD;
                });
                if (rival && Math.random() < DOMAIN_COUNTER_CHANCE) {
                    domainStart(rival);
                    floatingTexts.push(new FloatingText(rival.x, rival.y - 34, 'COUNTER DOMAIN!', '255, 255, 255'));
                }
            });

            // два враждебных домена одновременно — столкновение
            const ready = balls.filter(domainFlag);
            for (let i = 0; i < ready.length; i++) {
                for (let j = i + 1; j < ready.length; j++) {
                    if (!ready[i].isAlly(ready[j])) { startDomainClash(ready[i], ready[j]); return; }
                }
            }
            return;
        }

        const c = domainClash;
        if (!domainFlag(c.a) || !domainFlag(c.b)) { finishDomainClash(true); return; }

        c.t++;
        // владельцы замирают, пока идёт борьба; урон доменов приостановлен
        [c.a, c.b].forEach(function (x) { x.stunTimer = Math.max(x.stunTimer, 3); x.dx = 0; x.dy = 0; });

        // перетягивание: чуть выше шансы у того, у кого больше сил
        const pa = domainPower(c.a), pb = domainPower(c.b);
        const bias = pa / (pa + pb);
        c.bar += (bias - 0.5) * 0.006 + (Math.random() - 0.5) * 0.045;
        // рывки — внезапные натиски одной из сторон
        if (c.t % 30 === 0) {
            const side = Math.random() < bias ? 1 : -1;
            c.bar += side * 0.1;
            const who = side > 0 ? c.a : c.b;
            floatingTexts.push(new FloatingText(who.x, who.y - 34, 'PRESSURE!', domainColor(who)));
            playHitSound();
        }
        c.bar = Math.max(0.04, Math.min(0.96, c.bar));

        if (c.t >= DOMAIN_CLASH_FRAMES) finishDomainClash(false);
    }

    /* ---------------- ПРОСТОЙ ДОМЕН ---------------- */
    const JJK_TYPES = ['gojo', 'sukuna', 'megumi', 'ryu', 'yuta', 'naoya'];
    const WALLY_BASE = 2;            // стартовая скорость Уолли, px за кадр
    const WALLY_CAP = 50000 / 60;    // предел 50000 px/сек при 60 кадрах/сек (и у Уолли, и у Чёрного Флэша)
    const BIG_SIZE = 5000;           // вторая, большая арена — только в бою с Чёрным Флэшем
    const BIG_LO = -(BIG_SIZE - 500) / 2;   // маленькая арена лежит в центре большой
    const BIG_HI = BIG_LO + BIG_SIZE;
    // Cosmic Alien (в духе Космического Гароу)
    const CM_MAX_STACKS = 16;      // предел адаптации
    const CM_FEAR_HP = 35;         // ниже этого включается Космический Страх (однократно, с полным лечением)
    const CLONER_PERIOD = 180;   // раз в 3 сек каждая копия создаёт ещё одну (число копий ×2)
    const CLONER_MAX = 64;       // предел копий одновременно
    const CLONER_HP = 100;       // здоровье копии (настоящий клон — как у оригинала)
    const DOUBLING_MAX = Math.pow(2, 60);   // предел удвоений, чтобы числа не ушли в бесконечность
    const EGOR_WORLD = 50000;        // мир Егора в истинной форме: 50000×50000
    const BF_BASE = 5.2;             // стартовая скорость Чёрного Флэша, px за кадр
    const TG_ZONE_R = 180;           // радиус поля «Вязкое время»
    const SIMPLE_HP = 45;            // прочность барьера
    const SIMPLE_MAX_FRAMES = 180;   // дольше барьер не держится
    const SIMPLE_REACT_CHANCE = 0.12; // шанс раскрыть барьер в каждый кадр угрозы
    const SIMPLE_CD_OK = 300;        // перезарядка после обычного завершения
    const SIMPLE_CD_BROKEN = 600;    // после пробития барьера
    const SIMPLE_ERODE_GOJO = 2;     // домен Годжо разъедает барьер вдвое быстрее
    const SIMPLE_ERODE_SUKUNA = 1.5;

    function stepSimpleDomain() {
        if (timeStopOwner) return;
        const clash = domainClash;
        balls.forEach(function (b) {
            if (b.out || b.erased || b.isFakeDead || JJK_TYPES.indexOf(b.type) === -1) return;
            if (!b.simpleActive && b.simpleCd > 0) b.simpleCd--;

            // идёт ли враждебный домен (во время столкновения доменов урон приостановлен)
            const threat = balls.some(function (o) {
                if (o === b || !domainFlag(o) || b.isAlly(o)) return false;
                return !(clash && (clash.a === o || clash.b === o));
            });

            if (b.simpleActive) {
                b.simpleT++;
                if (b.simpleHp <= 0) {
                    b.simpleActive = false;
                    b.simpleCd = SIMPLE_CD_BROKEN;
                    b.stunTimer = Math.max(b.stunTimer, 40);
                    floatingTexts.push(new FloatingText(b.x, b.y - 36, 'SIMPLE DOMAIN BROKEN!', '255, 120, 120'));
                    playHitSound();
                } else if (!threat || b.simpleT >= SIMPLE_MAX_FRAMES) {
                    b.simpleActive = false;
                    b.simpleCd = SIMPLE_CD_OK;
                    floatingTexts.push(new FloatingText(b.x, b.y - 36, 'simple domain dropped', '178, 235, 242'));
                }
            } else if (threat && b.simpleCd <= 0 && !domainFlag(b) && Math.random() < SIMPLE_REACT_CHANCE) {
                b.simpleActive = true;
                b.simpleT = 0;
                b.simpleHp = SIMPLE_HP;
                if (b.stunTimer <= 4) b.stunTimer = 0;   // оглушение от домена Годжо не мешает раскрыть барьер
                floatingTexts.push(new FloatingText(b.x, b.y - 36, 'SIMPLE DOMAIN', '178, 235, 242'));
                playChargeSound(0.3);
            }
        });
    }

    /* ---------------- КАТ-СЦЕНА KO-KU-SEN ---------------- */
    // Гоку и Вегета: если один пал от рук врага, второй впадает в ярость
    function checkSaiyanRage() {
        balls.forEach(function (dead) {
            if ((dead.type !== 'goku' && dead.type !== 'vegeta') || dead.pactAvenged || !(dead.hp <= 0 || dead.out)) return;
            dead.pactAvenged = true;
            const partner = balls.find(function (b) {
                return (b.type === 'goku' || b.type === 'vegeta') && b.type !== dead.type && !b.out && b.hp > 0 && dead.isAlly(b);
            });
            if (!partner) return;
            if (partner.type === 'goku') {
                partner.gkRage = true; partner.gkUI = 2; partner.gkFlash = 60;
                floatingTexts.push(new FloatingText(partner.x, partner.y - 44, 'VEGETA!!! GOKU ENRAGED ×3', '255, 82, 82'));
            } else {
                partner.vgRage = true; partner.vgForm = 2; partner.vgStacks = 30; partner.vgFlash = 60;
                floatingTexts.push(new FloatingText(partner.x, partner.y - 44, 'KAKAROT!!! VEGETA ENRAGED', '255, 82, 82'));
            }
            playChargeSound(1);
        });
    }
    // One Shot + Гоку в одном бою: оба становятся сильнее на 15 000 000% (×150 000)
    const GK_POW = 150000;
    function checkGokuOneShot() {
        const os = balls.find(function (b) { return b.type === 'oneshot' && !b.out && !b.erased; });
        if (!os) return;
        balls.forEach(function (g) {
            if (g.type !== 'goku' || g.out || g.gkPow) return;
            g.gkPow = true;
            g.hp *= GK_POW;
            if (g.gkMax) g.gkMax *= GK_POW;
            floatingTexts.push(new FloatingText(g.x, g.y - 44, 'POWER +15 000 000%!', '255, 213, 79'));
            floatingTexts.push(new FloatingText(os.x, os.y - 44, 'POWER +15 000 000%!', '255, 82, 82'));
            g.gkFlash = 60;
            playChargeSound(1);
        });
    }
    const KOKU_Z = 2.4, KOKU_SYL = [52, 82, 112], KOKU_END = 140, KOKU_T = 178;
    function kokuEase(x) { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); }
    function kokuK() {
        if (!kokuScene) return 0;
        const t = kokuScene.t;
        if (t < 30) return kokuEase(t / 30);
        if (t < KOKU_END) return 1;
        return 1 - kokuEase((t - KOKU_END) / (KOKU_T - KOKU_END));
    }
    function kokuClampBall(b) {
        b.x = Math.max(b.radius, Math.min(W - b.radius, b.x));
        b.y = Math.max(b.radius, Math.min(H - b.radius, b.y));
    }
    function startKokuScene(yj, sk) {
        const ang = Math.atan2(sk.y - yj.y, sk.x - yj.x);
        const gap = yj.radius + sk.radius;
        kokuScene = {
            t: 0, yj: yj, sk: sk, ang: ang, shake: 0, flash: 0,
            sx: yj.x, sy: yj.y,
            wx: sk.x - Math.cos(ang) * (gap + 42), wy: sk.y - Math.sin(ang) * (gap + 42),
            hx: sk.x - Math.cos(ang) * (gap - 2), hy: sk.y - Math.sin(ang) * (gap - 2),
            kx: sk.x, ky: sk.y
        };
        [yj, sk].forEach(function (b) { b.dx = 0; b.dy = 0; });
        yj.yjZone = 180; yj.yjChain++;
        playChargeSound(0.5);
    }
    function stepKokuScene() {
        const c = kokuScene, yj = c.yj, sk = c.sk;
        c.t++;
        const t = c.t;
        if (c.shake > 0) c.shake--;
        if (c.flash > 0) c.flash--;
        yj.dx = 0; yj.dy = 0; sk.dx = 0; sk.dy = 0;
        yj.yjAng = c.ang;
        if (t <= 24) {
            const k = kokuEase(t / 24);
            yj.x = c.sx + (c.wx - c.sx) * k; yj.y = c.sy + (c.wy - c.sy) * k;
        } else if (t <= 34) {
            const k = (t - 24) / 10;
            yj.x = c.wx + (c.hx - c.wx) * k; yj.y = c.wy + (c.hy - c.wy) * k;
        }
        if (t === 34) {
            yj.yjPunchT = 10; yj.yjFlash = 16;
            c.shake = 14; c.flash = 8;
            playHitSound(); playExplosionSound();
            floatingTexts.push(new FloatingText(sk.x, sk.y - 26, 'BLACK FLASH!', '255, 40, 40'));
        }
        if (t >= 34 && t < 56) {
            // Сукуну отбрасывает назад, Юдзи не отстаёт
            const k = kokuEase((t - 34) / 22);
            sk.x = c.kx + Math.cos(c.ang) * 26 * k; sk.y = c.ky + Math.sin(c.ang) * 26 * k;
            yj.x = c.hx + Math.cos(c.ang) * 26 * k; yj.y = c.hy + Math.sin(c.ang) * 26 * k;
        }
        KOKU_SYL.forEach(function (st) {
            if (t === st) { c.shake = 12; c.flash = 4; playExplosionSound(); playHitSound(); }
        });
        kokuClampBall(yj); kokuClampBall(sk);
        if (t === KOKU_END) {
            c.shake = 24; c.flash = 16;
            playExplosionSound(); playChargeSound(0.9);
            floatingTexts.push(new FloatingText(sk.x, sk.y - 30, 'KOKUSEN!', '255, 40, 40'));
            sk.takeDamage(sk.hp * 2 + 200, 'other');
            if (!sk.out && sk.hp > 0) sk.hp = 0;
        }
        if (t >= KOKU_T) {
            kokuScene = null;
        }
    }
    function drawKokuUI() {
        const c = kokuScene;
        if (!c) return;
        const t = c.t, k = kokuK();
        // тёмная виньетка
        const g = ctx.createRadialGradient(250, 250, 90, 250, 250, 360);
        g.addColorStop(0, 'rgba(20, 0, 0, 0)');
        g.addColorStop(1, 'rgba(10, 0, 0, ' + (0.7 * k) + ')');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 500, 500);
        // лучи скорости после удара
        if (t >= 34 && t < 60) {
            const a = 1 - (t - 34) / 26;
            ctx.strokeStyle = 'rgba(255, 60, 60, ' + (0.7 * a) + ')';
            ctx.lineWidth = 2;
            for (let i = 0; i < 28; i++) {
                const an = i * Math.PI * 2 / 28 + 0.1;
                ctx.beginPath();
                ctx.moveTo(250 + Math.cos(an) * (70 + (t - 34) * 6), 250 + Math.sin(an) * (70 + (t - 34) * 6));
                ctx.lineTo(250 + Math.cos(an) * 360, 250 + Math.sin(an) * 360);
                ctx.stroke();
            }
        }
        if (c.flash > 0) {
            ctx.fillStyle = 'rgba(255, 255, 255, ' + (c.flash / 16 * 0.75) + ')';
            ctx.fillRect(0, 0, 500, 500);
        }
        const bar = 34 * k;
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, 500, bar);
        ctx.fillRect(0, 500 - bar, 500, bar);
        // слоги по очереди
        const pos = [[120, 170, 'KO', -0.12], [250, 260, 'KU', -0.05], [375, 350, 'SEN', 0.06]];
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        for (let i = 0; i < 3; i++) {
            const a = t - KOKU_SYL[i];
            if (a < 0) continue;
            const pop = Math.max(0, 1 - a / 9);
            const fade = t > KOKU_END + 10 ? Math.max(0, 1 - (t - KOKU_END - 10) / 20) : 1;
            ctx.save();
            ctx.globalAlpha = Math.min(1, (a + 1) / 3) * fade;
            ctx.translate(pos[i][0] + (Math.random() - 0.5) * 3 * pop, pos[i][1] + (Math.random() - 0.5) * 3 * pop);
            ctx.rotate(pos[i][3]);
            ctx.scale(1 + pop * 1.4, 1 + pop * 1.4);
            ctx.font = 'italic 900 92px Impact, "Arial Black", sans-serif';
            ctx.lineJoin = 'round';
            ctx.lineWidth = 12;
            ctx.strokeStyle = '#000';
            ctx.strokeText(pos[i][2], 4, 5);
            ctx.lineWidth = 8;
            ctx.strokeStyle = '#d50000';
            ctx.strokeText(pos[i][2], 0, 0);
            ctx.fillStyle = '#fff';
            ctx.fillText(pos[i][2], 0, 0);
            ctx.restore();
        }
        if (t >= KOKU_END) {
            const a = t - KOKU_END;
            ctx.save();
            ctx.globalAlpha = Math.min(1, a / 6) * (t > KOKU_T - 20 ? Math.max(0, (KOKU_T - t) / 20) : 1);
            ctx.font = 'bold 40px sans-serif';
            ctx.fillStyle = '#ff5252';
            ctx.fillText('黒閃', 250, 458);
            ctx.restore();
        }
        ctx.textBaseline = 'alphabetic';
    }

    /* ---------------- ЦИКЛ ---------------- */
    // Космик убил Робота при живом One Shot: вырывает реактор → One Shot в ярости ×1500
    function checkRobotCutscene() {
        if (cutscene) return;
        const rb = balls.find(function (b) { return b.type === 'robot' && !b.out && b.hp <= 0 && !b.rbRipped; });
        if (!rb) return;
        const os = balls.find(function (b) { return b.type === 'oneshot' && !b.out && !b.osRage && rb.isAlly(b); });
        const cs = balls.find(function (b) { return b.type === 'cosmic' && !b.out && b.hp > 0 && !rb.isAlly(b); });
        if (!os || !cs) return;
        rb.rbRipped = true;
        rb.hp = 1;
        cutscene = { t: 0, rb: rb, os: os, cs: cs, rx: rb.x, ry: rb.y };
        [rb, os, cs].forEach(function (b) {
            b.dx = 0; b.dy = 0; b.rbState = ''; b.cmState = ''; b.opPhase = 0; b.opFx = 0;
            b.isOneShotCharging = false; b.strikeTimer = 0; b.osMove = ''; b.osRing = []; b.osSeries = false; b.osQueue = [];
        });
        cs.cmCopy = null;
    }

    function stepCutscene() {
        const c = cutscene;
        c.t++;
        const t = c.t, rb = c.rb, cs = c.cs, os = c.os;
        if (t === 1) {
            const side = rb.x < W / 2 ? 1 : -1;
            cs.x = Math.max(cs.radius, Math.min(W - cs.radius, rb.x + side * (rb.radius + cs.radius + 4)));
            cs.y = rb.y;
            cs.cmFx = 16;
            playChargeSound(0.8);
            floatingTexts.push(new FloatingText(rb.x, rb.y - 40, 'ROBOT DEFEATED…', '176, 190, 197'));
        }
        if (t === 55) {
            floatingTexts.push(new FloatingText(Math.min(W - 70, Math.max(70, cs.x)), cs.y - 44, 'RIPS OUT THE REACTOR!', '255, 213, 79'));
            playChargeSound(1);
        }
        if (t >= 55 && t < 100) { rb.x += (Math.random() - 0.5) * 2; rb.y += (Math.random() - 0.5) * 2; }
        if (t === 100) {
            rb.rbCoreOut = true;
            rb.color = '#455a64';
            rb.hp = 0;
            // реактор даёт Космику ×10 HP (и максимум тоже)
            cs.cmMax *= 10;
            cs.hp *= 10;
            floatingTexts.push(new FloatingText(Math.min(W - 70, Math.max(70, cs.x)), cs.y - 66, 'HP ×10!', '255, 214, 79'));
            c.flash = 14;
            playExplosionSound();
            floatingTexts.push(new FloatingText(Math.min(W - 70, Math.max(70, cs.x)), cs.y - 44, 'REACTOR CRUSHED', '255, 255, 255'));
        }
        if (c.flash > 0) c.flash--;
        if (t === 130) {
            // ещё ×100 к HP Космика
            cs.cmMax *= 100;
            cs.hp *= 100;
            floatingTexts.push(new FloatingText(Math.min(W - 70, Math.max(70, cs.x)), cs.y - 66, 'HP ×100 MORE!', '255, 214, 79'));
            playChargeSound(0.6);
        }
        if (t >= 105 && t < 185) { os.x += (Math.random() - 0.5) * 3; os.y += (Math.random() - 0.5) * 3; }
        if (t === 112) {
            floatingTexts.push(new FloatingText(os.x, os.y - 44, 'ONE SHOT IS FURIOUS…', '255, 80, 80'));
            playChargeSound(1.5);
        }
        if (t === 150) floatingTexts.push(new FloatingText(os.x, os.y - 44, 'POWER ×1500!', '255, 60, 60'));
        if (t >= 185) {
            os.osRage = true;
            os.radius = Math.round(os.radius * 1.3);
            os.oneShotCooldown = 240;
            os.randomizeVelocity();
            playExplosionSound();
            cutscene = null;
        }
    }

    function drawCutscene() {
        const c = cutscene;
        if (!c) return;
        const t = c.t;
        if (t >= 55 && t < 100) {
            const k = (t - 55) / 45, e = k * k * (3 - 2 * k);
            const rx = c.rb.x + (c.cs.x - c.rb.x) * e * 0.8, ry = c.rb.y - 34 * Math.sin(e * Math.PI) + (c.cs.y - c.rb.y) * e * 0.8;
            ctx.beginPath();
            ctx.moveTo(c.rb.x, c.rb.y + 2);
            ctx.lineTo(rx, ry);
            ctx.strokeStyle = 'rgba(255, 183, 77, 0.7)';
            ctx.lineWidth = 2;
            ctx.stroke();
            const g = ctx.createRadialGradient(rx, ry, 1, rx, ry, 16);
            g.addColorStop(0, '#fffde7');
            g.addColorStop(0.5, '#ffb300');
            g.addColorStop(1, 'rgba(255, 112, 67, 0)');
            ctx.beginPath();
            ctx.arc(rx, ry, 16, 0, Math.PI * 2);
            ctx.fillStyle = g;
            ctx.fill();
        }
        if (t >= 100 && t < 125) {
            const k = (t - 100) / 25;
            ctx.beginPath();
            ctx.arc(c.cs.x, c.cs.y, 10 + k * 90, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(255, 213, 79, ' + (1 - k) + ')';
            ctx.lineWidth = 5;
            ctx.stroke();
        }
    }

    function drawCutsceneUI() {
        const ser = balls.find(function (b) { return b.type === 'oneshot' && !b.out && b.osSeries; });
        if (ser && !cutscene) {
            ctx.fillStyle = 'rgba(40, 0, 0, 0.35)';
            ctx.fillRect(0, 0, 500, 500);
            ctx.fillStyle = '#000';
            ctx.fillRect(0, 0, 500, 26);
            ctx.fillRect(0, 474, 500, 26);
            ctx.fillStyle = '#ff6e6e';
            ctx.font = 'bold 14px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('KILLER MOVE: SERIOUS SERIES', 250, 493);
        }
        const c = cutscene;
        if (!c) return;
        const t = c.t;
        if (t > 105) {
            ctx.fillStyle = 'rgba(120, 0, 0, ' + (0.38 * Math.min(1, (t - 105) / 60)) + ')';
            ctx.fillRect(0, 0, 500, 500);
        }
        if (c.flash > 0) {
            ctx.fillStyle = 'rgba(255, 255, 255, ' + (c.flash / 14 * 0.8) + ')';
            ctx.fillRect(0, 0, 500, 500);
        }
        const bar = 38 * Math.min(1, t / 12);
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, 500, bar);
        ctx.fillRect(0, 500 - bar, 500, bar);
        let cap = 'Cosmic catches up with the robot…';
        if (t >= 55 && t < 100) cap = 'Cosmic rips out the reactor!';
        else if (t >= 100) cap = 'One Shot enraged: power ×1500!';
        ctx.fillStyle = t >= 100 ? '#ff6e6e' : '#ffe082';
        ctx.font = 'bold 15px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(cap, 250, 500 - bar / 2 + 5);
    }

    function breakArena(os, cs) {
        arenaBroken = true;
        arenaBreakT = 0;
        arenaFx = 100;
        const OFF = 125;
        const mx = (os.x + cs.x) / 2 + OFF, my = (os.y + cs.y) / 2 + OFF;
        W = 750;
        H = 750;
        balls.forEach(function (b) {
            b.x += OFF; b.y += OFF; b.px += OFF; b.py += OFF;
            b.ghostX += OFF; b.ghostY += OFF;
            b.bigTrail = null;
            if (b.cmMeteors) b.cmMeteors = [];
        });
        floatingTexts.forEach(function (t) { t.x += OFF; t.y += OFF; });
        os.opPhase = 0; os.opT = 0; os.opFx = 0;
        cs.opPhase = 0; cs.opT = 0; cs.opFx = 0;
        os.oneShotCooldown = 0;
        os.randomizeVelocity();
        cs.cmCdK = 300;
        cs.cmMax *= 250;
        cs.hp *= 250;
        cs.cmInvuln = Math.max(cs.cmInvuln, 45);
        cs.cmBlast = 30;
        cs.cmBlastR = 220;
        // трещины от центра старой арены
        arenaCracks = [];
        for (let i = 0; i < 16; i++) {
            const a = i / 16 * Math.PI * 2 + (Math.random() - 0.5) * 0.3;
            let x = 375, y = 375, aa = a;
            const pts = [[x, y]];
            const L = 160 + Math.random() * 230;
            for (let d = 0; d < L; d += 28) {
                aa += (Math.random() - 0.5) * 0.5;
                x += Math.cos(aa) * 28; y += Math.sin(aa) * 28;
                pts.push([x, y]);
            }
            arenaCracks.push(pts);
        }
        blastTimer = 0;
        floatingTexts.push(new FloatingText(375, 330, 'ARENA BROKEN!', '255, 255, 255'));
        floatingTexts.push(new FloatingText(375, 365, 'NEW ARENA 750×750', '224, 187, 255'));
        floatingTexts.push(new FloatingText(cs.x, cs.y - 50, 'COSMIC HP ×250!', '255, 214, 79'));
        floatingTexts.push(new FloatingText(mx, my, '💥', '255, 255, 255'));
        playExplosionSound();
        playChargeSound(0.8);
    }

    // кулаки One Shot и Космика — одновременно в ходу → арена ломается
    function checkArenaBreak() {
        if (arenaBroken) return;
        const os = balls.find(function (b) { return b.type === 'oneshot' && !b.out && b.opPhase > 0; });
        const cs = balls.find(function (b) { return b.type === 'cosmic' && !b.out && b.opPhase > 0; });
        if (os && cs && (os.opPhase === 2 || cs.opPhase === 2)) breakArena(os, cs);   // кулаки столкнулись
    }

    function stepArenaView() {
        if (!arenaBroken) return;
        arenaBreakT++;
        if (arenaFx > 0) arenaFx--;
        const k = Math.min(1, arenaBreakT / 80);
        viewZoom = 1 - (1 - 500 / 750) * (1 - Math.pow(1 - k, 3));
    }

    function update() {
        if (raceState) { updateRace(); return; }
        if (contactCooldown > 0) contactCooldown--;
        if (kokuScene) {
            stepKokuScene();
            floatingTexts.forEach(function (t) { t.update(); });
            floatingTexts = floatingTexts.filter(function (t) { return t.life > 0; });
            return;
        }
        checkGokuOneShot();
        checkSaiyanRage();
        if (cutscene) {
            stepCutscene();
            floatingTexts.forEach(function (t) { t.update(); });
            floatingTexts = floatingTexts.filter(function (t) { return t.life > 0; });
            return;
        }

        // накопление энергии перед взрывом: столкнувшиеся шары замирают
        if (blastCharge > 0) {
            blastBalls.forEach(function (b) { b.stunTimer = Math.max(b.stunTimer, 2); });
            blastCharge--;
            if (blastCharge === 0) laserBlast(blastX, blastY);
        }

        for (let ci = balls.length - 1; ci >= 0; ci--) { if (balls[ci].isCopy && balls[ci].out) balls.splice(ci, 1); }
        balls.forEach(function (b) { b.px = b.x; b.py = b.y; });
        balls.forEach(function (b) {
            const px = b.x, py = b.y;
            b.update();
            // кресло Мёбиуса: после вставания скорость ×1000 (путь «сворачивается» отражением от стен)
            if ((b.type === 'wally' || b.type === 'egor') && b.wChair && b.wSit <= 0 && !b.out && !b.isFakeDead && b.holdTimer <= 0) {
                const fold = function (v, lo, hi) {
                    const rg = hi - lo, t = (((v - lo) % (2 * rg)) + 2 * rg) % (2 * rg);
                    return lo + (t > rg ? 2 * rg - t : t);
                };
                b.x = fold(px + (b.x - px) * 1000, b.radius, W - b.radius);
                b.y = fold(py + (b.y - py) * 1000, b.radius, H - b.radius);
            }
            b._mvx = b.x - px; b._mvy = b.y - py; b._mv = Math.hypot(b._mvx, b._mvy);
        });
        // Black Flash адаптируется: двигается минимум на 10% быстрее самого быстрого противника
        balls.forEach(function (b) {
            if (b.type !== 'blackflash' || b.out || b.holdTimer > 0 || b._mv < 0.01) return;
            let mx = 0;
            balls.forEach(function (o) { if (o !== b && !o.out && o.team !== b.team && !o.isFakeDead) mx = Math.max(mx, o._mv || 0); });
            mx = Math.min(mx, 60);
            if (b._mv < mx * 1.1) {
                const k = (mx * 1.1) / b._mv - 1;
                b.x = Math.max(b.radius, Math.min(W - b.radius, b.x + b._mvx * k));
                b.y = Math.max(b.radius, Math.min(H - b.radius, b.y + b._mvy * k));
                b._mv = Math.hypot(b._mvx * (1 + k), b._mvy * (1 + k));
            }
        });
        // поле «Вязкое время»: за кадр проходится лишь 40% пути
        balls.forEach(function (b) {
            if (b.type === 'wally' || b.type === 'egor') { b.slowT = 0; return; }
            if (b.slowT > 0) {
                b.slowT--;
                b.x = b.px + (b.x - b.px) * 0.4;
                b.y = b.py + (b.y - b.py) * 0.4;
            }
        });
        checkArenaBreak();
        stepArenaView();
        checkLaserClash();
        if (blastTimer > 0) blastTimer--;
        balls.forEach(wallBounce);
        collide();
        recordBigTrail();

        floatingTexts.forEach(function (t) { t.update(); });
        floatingTexts = floatingTexts.filter(function (t) { return t.life > 0; });

        // Автор один раз «умирает понарошку»
        balls.forEach(function (b) {
            if (b.hp <= 0 && b.type === 'author' && !b.isFakeDead && !b.sealed && !b.erased) b.startFakeDeath();
        });

        // Сукуна убивает Мегуми → становится Мегуной (Сукуна + Мегуми)
        const megumi = balls.find(function (b) { return b.type === 'megumi' && !b.out; });
        const sukuna = balls.find(function (b) { return b.type === 'sukuna' && !b.out && !b.isMeguna; });
        if (sukuna && megumi && megumi.hp <= 0) {
            megumi.out = true;
            floatingTexts.push(new FloatingText(megumi.x, megumi.y - 30, 'MEGUMI HAS FALLEN...', '120, 144, 156'));
            // трансформация: остаётся Сукуной, но получает силы Мегуми
            sukuna.isMeguna = true;
            sukuna.name = 'Meguna';
            sukuna.color = '#e91e63';
            sukuna.hp = Math.min(150, sukuna.hp + 60);
            sukuna.domainSukunaActive = false;
            sukuna.domainCooldown = 0;
            sukuna.mahoragaTimer = 280;
            sukuna.shadowTimer = 0;
            floatingTexts.push(new FloatingText(sukuna.x, sukuna.y - 40, 'MEGUNA AWAKENED!', '255, 64, 129'));
            playExplosionSound();
            playTimeStopSound();
        }

        stepDomainClash();
        stepSimpleDomain();

        updateBattleMusic();
        checkRobotCutscene();
        if (cutscene) return;
        checkEnd();
    }

    function drawBigArena() {
        const act = worldActors();
        if (!act.length) return;
        const S = act.some(function (b) { return b.type === 'egor' && b.egTrueUsed; }) ? EGOR_WORLD : BIG_SIZE;
        const LO = -(S - W) / 2;
        const visible = function (b) { return b.x > -b.radius && b.x < W + b.radius && b.y > -b.radius && b.y < H + b.radius; };
        const off = act.filter(function (b) { return !visible(b); });
        if (!off.length) return;
        const colorOf = function (b) { return b.type === 'egor' ? '#b2ff59' : (b.type === 'blackflash' ? '#ff1744' : '#4fc3f7'); };
        const nameOf = function (b) { return b.type === 'egor' ? 'Egor' : (b.type === 'blackflash' ? 'B. Flash' : 'Wally'); };
        const speedOf = function (b) { return b.type === 'egor' ? b.egSpeed : (b.type === 'blackflash' ? b.bfSpeed : b.wSpeed); };

        const drawMap = function (mx, my, ms, full) {
            const sc = ms / S;
            const tx = function (v) { return mx + (v - LO) * sc; };
            const ty = function (v) { return my + (v - LO) * sc; };
            ctx.globalAlpha = full ? 1 : 0.88;
            ctx.fillStyle = '#0b0f14';
            ctx.fillRect(mx, my, ms, ms);
            ctx.globalAlpha = 1;
            if (full) {
                ctx.strokeStyle = 'rgba(79, 195, 247, 0.12)';
                ctx.lineWidth = 1;
                for (let g = 1; g < 10; g++) {
                    ctx.beginPath(); ctx.moveTo(mx + g * ms / 10, my); ctx.lineTo(mx + g * ms / 10, my + ms); ctx.stroke();
                    ctx.beginPath(); ctx.moveTo(mx, my + g * ms / 10); ctx.lineTo(mx + ms, my + g * ms / 10); ctx.stroke();
                }
            }
            ctx.strokeStyle = '#4fc3f7';
            ctx.lineWidth = full ? 2 : 1.5;
            ctx.strokeRect(mx, my, ms, ms);
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1;
            ctx.strokeRect(tx(0), ty(0), Math.max(3, W * sc), Math.max(3, H * sc));
            if (full) {
                ctx.fillStyle = 'rgba(255,255,255,0.7)';
                ctx.font = '10px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText('arena 500×500', tx(W / 2), ty(H) + 14);
            }
            ctx.textAlign = 'left';
            ctx.fillStyle = 'rgba(129, 212, 250, 0.9)';
            ctx.font = full ? 'bold 12px sans-serif' : 'bold 9px sans-serif';
            ctx.fillText(full ? 'BIG ARENA ' + S + '×' + S : S + '×' + S, mx + 6, my + (full ? 16 : 11));
            if (full) {
                act.forEach(function (b) {
                    const tr = b.bigTrail || [];
                    ctx.strokeStyle = colorOf(b);
                    ctx.lineWidth = 2;
                    for (let i = 1; i < tr.length; i++) {
                        ctx.globalAlpha = i / tr.length * 0.7;
                        ctx.beginPath(); ctx.moveTo(tx(tr[i - 1][0]), ty(tr[i - 1][1])); ctx.lineTo(tx(tr[i][0]), ty(tr[i][1])); ctx.stroke();
                    }
                    ctx.globalAlpha = 1;
                });
            }
            act.forEach(function (b, i) {
                ctx.beginPath();
                ctx.arc(tx(b.x), ty(b.y), full ? 7 : 4, 0, Math.PI * 2);
                ctx.fillStyle = colorOf(b);
                ctx.fill();
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = full ? 2 : 1;
                ctx.stroke();
                if (full) {
                    ctx.fillStyle = '#fff';
                    ctx.font = '11px sans-serif';
                    ctx.textAlign = 'left';
                    ctx.fillText(nameOf(b), tx(b.x) + 10, ty(b.y) + 4);
                    ctx.fillStyle = colorOf(b);
                    ctx.fillText(nameOf(b) + ': ' + Math.round(speedOf(b) * 60) + ' px/s', mx + 8, my + ms - 10 - i * 14);
                }
            });
        };

        if (act.length >= 2 && off.length === act.length) {
            // все, кто может выходить за арену, сейчас за её пределами: карта на весь экран
            drawMap(20, 40, 460, true);
            return;
        }
        // иначе: миникарта в углу и стрелки к тем, кого не видно
        drawMap(W - 118, H - 118, 108, false);
        off.forEach(function (b) {
            const col = colorOf(b);
            const ang = Math.atan2(b.y - H / 2, b.x - W / 2);
            const c = Math.cos(ang), sn = Math.sin(ang);
            const t = Math.min((W / 2 - 16) / Math.max(0.001, Math.abs(c)), (H / 2 - 16) / Math.max(0.001, Math.abs(sn)));
            const px = W / 2 + c * t, py = H / 2 + sn * t;
            ctx.save();
            ctx.translate(px, py);
            ctx.rotate(ang);
            ctx.beginPath();
            ctx.moveTo(10, 0); ctx.lineTo(-8, -8); ctx.lineTo(-8, 8);
            ctx.closePath();
            ctx.fillStyle = col;
            ctx.fill();
            ctx.restore();
            ctx.fillStyle = col;
            ctx.font = '11px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(nameOf(b) + ' ' + Math.round(Math.hypot(b.x - W / 2, b.y - H / 2)) + ' px', Math.max(50, Math.min(W - 50, px - c * 26)), Math.max(14, Math.min(H - 6, py - sn * 26)));
        });
    }

    function drawHud() {
        const hudBalls = balls.filter(function (b) { return !b.isCopy; });
        const n = hudBalls.length;
        const barW = Math.min(200, Math.floor((W - 24 - (n - 1) * 10) / n));
        const gap = n > 1 ? (W - 24 - n * barW) / (n - 1) : 0;
        hudBalls.forEach(function (b, i) {
            const x = 12 + i * (barW + gap);
            const immortal = (b.type === 'oneshot' && !b.erased) || b.type === 'muha1';
            let maxHp = 100;
            if (b.type === 'muha2') maxHp = 10;
            else if (b.type === 'mahoraga') maxHp = 200;
            else if (b.isMeguna) maxHp = 150;
            else if (b.type === 'doubling') maxHp = 100 * b.dbMul;
            else if (b.type === 'cloner') maxHp = 100;
            else if (b.type === 'yuji') maxHp = 130;
            else if (b.type === 'todo') maxHp = 120;
            else if (b.type === 'goku') maxHp = b.gkPow ? 150 * GK_POW : 150;
            else if (b.type === 'vegeta') maxHp = 150;
            else if (b.type === 'gblack') maxHp = 250;
            else if (b.type === 'cosmic') maxHp = b.cmMax;
            else if (b.type === 'author' && b.supreme) maxHp = 300;
            else if (b.type === 'egor') maxHp = (b.egTrueUsed ? 10000 : 100) * b.egMul;
            let grpCnt = 0, hp;
            if (b.type === 'cloner') {
                // полоска — суммарное здоровье всех живых копий
                let sum = 0, mx = 0;
                balls.forEach(function (o) {
                    if (!o.out && o.cloneGroup === b.cloneGroup) { grpCnt++; sum += Math.max(0, o.hp); mx += o.isCopy ? CLONER_HP : 100; }
                });
                hp = mx > 0 ? sum / mx : 0;
            } else {
                hp = immortal ? 1 : Math.max(0, b.hp) / maxHp;
            }
            ctx.fillStyle = '#000';
            ctx.fillRect(x, 22, barW, 8);
            ctx.fillStyle = b.color === '#1a1a1a' ? '#ff3333' : b.color;
            ctx.fillRect(x, 22, barW * hp, 8);
            ctx.strokeStyle = '#777';
            ctx.lineWidth = 1;
            ctx.strokeRect(x, 22, barW, 8);
            ctx.fillStyle = (b.out && !grpCnt) ? '#888' : 'white';
            ctx.font = '11px sans-serif';
            ctx.textAlign = 'left';
            let suffix = '';
            if (immortal) suffix = b.osRage ? '  ∞ ×1500' : '  ∞';
            else if (b.type === 'muha2') suffix = '  ' + Math.max(0, Math.round(b.hp)) + '❤';
            else if (b.type === 'mahoraga') suffix = '  ' + Math.max(0, Math.round(b.hp)) + ' HP';
            if (b.type === 'cosmic' && b.cmMax > 100) suffix = '  ' + Math.max(0, Math.round(b.hp)) + ' HP';
            if (b.type === 'goku' && b.gkPow) suffix = '  ' + (Math.max(0, b.hp) / 1e6).toFixed(1) + 'M HP  ×150 000';
            if (b.type === 'cloner') suffix = '  ×' + grpCnt;
            if (b.out && !grpCnt) suffix += '  ✖';
            ctx.fillText(b.name + suffix, x, 16);
        });
    }

    // фон столкновения: левая половина — домен первого, правая — второго (под шарами)
    function drawDomainClashBack() {
        const c = domainClash;
        if (!c) return;
        const bx = c.bar * W;

        [[0, bx, c.a], [bx, W, c.b]].forEach(function (sd) {
            const owner = sd[2], kind = domainKindOf(owner);
            ctx.save();
            ctx.beginPath();
            ctx.rect(sd[0], 0, sd[1] - sd[0], H);
            ctx.clip();
            if (kind === 'void') {
                ctx.fillStyle = 'rgba(8, 10, 70, 0.7)';
                ctx.fillRect(0, 0, W, H);
                for (let i = 0; i < 46; i++) {
                    const sx = (i * 97 + c.t * (0.8 + (i % 5) * 0.2)) % W;
                    const sy = (i * 53 + (i % 7) * 31) % H;
                    ctx.fillStyle = 'rgba(255, 255, 255, ' + (((i + (c.t >> 2)) % 2) ? 0.95 : 0.4) + ')';
                    ctx.fillRect(sx, sy, 2, 2);
                }
            } else {
                ctx.fillStyle = kind === 'meguna' ? 'rgba(100, 0, 45, 0.7)' : 'rgba(95, 0, 0, 0.7)';
                ctx.fillRect(0, 0, W, H);
                const step = Math.floor(c.t / 3);
                for (let i = 0; i < 9; i++) {
                    const q = function (n) { return ((i + 1) * (step + 7) * 9301 * n + 49297) % 233280 / 233280; };
                    const x1 = q(1) * W, y1 = q(2) * H, ang = q(3) * Math.PI * 2, len = 60 + q(4) * 140;
                    ctx.beginPath();
                    ctx.moveTo(x1, y1);
                    ctx.lineTo(x1 + Math.cos(ang) * len, y1 + Math.sin(ang) * len);
                    ctx.strokeStyle = (i % 3 ? 'rgba(255, 80, 80, 0.85)' : 'rgba(255, 255, 255, 0.85)');
                    ctx.lineWidth = 2;
                    ctx.stroke();
                }
            }
            ctx.restore();
        });

    }

    // граница, шкала борьбы и вспышка (поверх шаров)
    function drawDomainClash() {
        if (clashFlash > 0) {
            const k = clashFlash / 40;
            ctx.fillStyle = 'rgba(255, 255, 255, ' + (0.6 * k) + ')';
            ctx.fillRect(0, 0, W, H);
            ctx.beginPath();
            ctx.arc(clashFlashX, clashFlashY, (1 - k) * 520, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(' + clashFlashColor + ', ' + k + ')';
            ctx.lineWidth = 12 * k + 2;
            ctx.stroke();
        }
        const c = domainClash;
        if (!c) return;
        const bx = c.bar * W;

        // дрожащая граница с искрами
        ctx.beginPath();
        ctx.moveTo(bx, 0);
        for (let y = 25; y <= H; y += 25) ctx.lineTo(bx + (Math.random() - 0.5) * 18, y);
        ctx.strokeStyle = 'rgba(255, 230, 120, 0.45)';
        ctx.lineWidth = 12;
        ctx.stroke();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
        ctx.lineWidth = 4;
        ctx.stroke();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.lineWidth = 2;
        for (let i = 0; i < 8; i++) {
            const sy = Math.random() * H, a = Math.random() * Math.PI * 2;
            ctx.beginPath();
            ctx.moveTo(bx, sy);
            ctx.lineTo(bx + Math.cos(a) * 22, sy + Math.sin(a) * 22);
            ctx.stroke();
        }

        // шкала борьбы
        const barW = 280, bxL = W / 2 - barW / 2, by = 92;
        const pulse = 1 + 0.06 * Math.sin(c.t * 0.4);
        ctx.save();
        ctx.translate(W / 2, 80);
        ctx.scale(pulse, pulse);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 18px sans-serif';
        ctx.textAlign = 'center';
        ctx.lineWidth = 4;
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.strokeText('DOMAIN CLASH', 0, 0);
        ctx.fillText('DOMAIN CLASH', 0, 0);
        ctx.restore();
        ctx.fillStyle = '#000';
        ctx.fillRect(bxL - 2, by - 2, barW + 4, 16);
        ctx.fillStyle = 'rgb(' + domainColor(c.a) + ')';
        ctx.fillRect(bxL, by, barW * c.bar, 12);
        ctx.fillStyle = 'rgb(' + domainColor(c.b) + ')';
        ctx.fillRect(bxL + barW * c.bar, by, barW * (1 - c.bar), 12);
        ctx.fillStyle = '#fff';
        ctx.fillRect(bxL + barW * c.bar - 2, by - 5, 4, 22);
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillStyle = 'rgb(' + domainColor(c.a) + ')';
        ctx.fillText(c.a.name + ' — ' + domainName(c.a), bxL, by + 30);
        ctx.textAlign = 'right';
        ctx.fillStyle = 'rgb(' + domainColor(c.b) + ')';
        ctx.fillText(c.b.name + ' — ' + domainName(c.b), bxL + barW, by + 44);
    }

    function draw() {
        if (raceState) { drawRace(); return; }
        ctx.clearRect(0, 0, W, H);
        ctx.fillStyle = arenaBroken ? '#0b0b10' : '#222';
        ctx.fillRect(0, 0, W, H);
        ctx.save();
        if (arenaFx > 0) {
            const ak = arenaFx / 100;
            ctx.translate((Math.random() - 0.5) * 14 * ak, (Math.random() - 0.5) * 14 * ak);
        } else if (blastCharge > 0) {
            const sk = 1 - blastCharge / blastChargeMax;
            ctx.translate((Math.random() - 0.5) * 7 * sk, (Math.random() - 0.5) * 7 * sk);
        } else if (kokuScene && kokuScene.shake > 0) {
            ctx.translate((Math.random() - 0.5) * kokuScene.shake * 0.7, (Math.random() - 0.5) * kokuScene.shake * 0.7);
        } else if (cutscene && cutscene.t > 105) {
            ctx.translate((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6);
        } else if (domainClash) {
            ctx.translate((Math.random() - 0.5) * 4, (Math.random() - 0.5) * 4);
        }

        // камера: после разлома арена 750×750 вписывается в холст
        ctx.save();
        let kz = 1, kfx = W / 2, kfy = H / 2;
        if (kokuScene) {
            const kk = kokuK();
            kz = 1 + (KOKU_Z - 1) * kk;
            kfx = W / 2 + ((kokuScene.yj.x + kokuScene.sk.x) / 2 - W / 2) * kk;
            kfy = H / 2 + ((kokuScene.yj.y + kokuScene.sk.y) / 2 - H / 2) * kk;
            const half = 250 / (viewZoom * kz);
            if (W > half * 2) kfx = Math.max(half, Math.min(W - half, kfx));
            if (H > half * 2) kfy = Math.max(half, Math.min(H - half, kfy));
        }
        ctx.translate(250, 250);
        ctx.scale(viewZoom * kz, viewZoom * kz);
        ctx.translate(-kfx, -kfy);
        if (arenaBroken) {
            ctx.fillStyle = '#222';
            ctx.fillRect(0, 0, W, H);
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.10)';
            ctx.lineWidth = 2;
            ctx.setLineDash([10, 8]);
            ctx.strokeRect(125, 125, 500, 500);
            ctx.setLineDash([]);
            ctx.strokeStyle = 'rgba(224, 187, 255, 0.55)';
            ctx.lineWidth = 2;
            arenaCracks.forEach(function (pts) {
                ctx.beginPath();
                ctx.moveTo(pts[0][0], pts[0][1]);
                for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
                ctx.stroke();
            });
            ctx.strokeStyle = 'rgba(179, 136, 255, 0.85)';
            ctx.lineWidth = 5;
            ctx.strokeRect(2.5, 2.5, W - 5, H - 5);
        }
        drawDomainClashBack();

        // остальные шары, затем затемнение, затем шар, остановивший время
        const tgStop = balls.find(function (b) { return b.type === 'timegod' && b.tgPhase === 'stop' && !b.out; });
        balls.forEach(function (b) { if (b !== timeStopOwner && b !== tgStop) b.draw(); });
        balls.forEach(function (b) { if (b.type === 'author' && b.supreme && !b.out) b.drawSupremeFx(); });
        if (tgStop) {
            ctx.fillStyle = 'rgba(150, 125, 60, 0.32)';
            ctx.fillRect(0, 0, W, H);
            tgStop.draw();
            ctx.fillStyle = 'rgba(255, 224, 130, 0.95)';
            ctx.font = 'bold 15px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('FROZEN TIME — damage stored: ' + tgStop.tgBank, W / 2, H - 14);
        }
        if (timeStopOwner) {
            ctx.fillStyle = 'rgba(110, 110, 170, 0.35)';
            ctx.fillRect(0, 0, W, H);
            timeStopOwner.draw();
            ctx.fillStyle = 'rgba(255, 234, 0, 0.95)';
            ctx.font = 'bold 16px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('TIME STOPPED — hits left: ' + (timeStopOwner.stopHitsLeft || 0), W / 2, H - 14);
        }

        if (tgStop || timeStopOwner) {
            balls.forEach(function (b) {
                if ((b.type === 'wally' || b.type === 'egor') && !b.out && b !== tgStop && b !== timeStopOwner) b.draw();
            });
        }

        // Домены на всю карту
        const anyGojoDomain = balls.some(function (b) {
            return b.type === 'gojo' && b.domainActive && !b.out;
        });
        const anySukunaDomain = balls.some(function (b) {
            return b.type === 'sukuna' && b.domainSukunaActive && !b.out;
        });
        const megunaDomain = balls.find(function (b) {
            return b.type === 'sukuna' && b.isMeguna && b.domainSukunaActive && !b.out;
        });
        if (anyGojoDomain && !domainClash) {
            ctx.fillStyle = 'rgba(100, 180, 255, 0.18)';
            ctx.fillRect(0, 0, W, H);
            ctx.strokeStyle = 'rgba(144, 202, 249, 0.5)';
            ctx.lineWidth = 6;
            ctx.strokeRect(4, 4, W - 8, H - 8);
            ctx.fillStyle = 'rgba(144, 202, 249, 0.9)';
            ctx.font = 'bold 14px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('DOMAIN: INFINITE VOID', W / 2, 48);
        }
        if (anySukunaDomain && !domainClash) {
            ctx.fillStyle = megunaDomain ? 'rgba(200, 20, 80, 0.18)' : 'rgba(200, 30, 30, 0.16)';
            ctx.fillRect(0, 0, W, H);
            ctx.strokeStyle = megunaDomain ? 'rgba(255, 64, 129, 0.6)' : 'rgba(255, 80, 80, 0.55)';
            ctx.lineWidth = 6;
            ctx.strokeRect(8, 8, W - 16, H - 16);
            ctx.fillStyle = megunaDomain ? 'rgba(255, 64, 129, 0.95)' : 'rgba(255, 100, 100, 0.9)';
            ctx.font = 'bold 14px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(megunaDomain ? 'DOMAIN: MEGUNA' : 'DOMAIN: MALEVOLENT SHRINE', W / 2, anyGojoDomain ? 68 : 48);
        }

        drawDomainClash();

        // вспышка и волна взрыва на всю арену
        if (blastTimer > 0) {
            const kind = blastKind || BLAST_KINDS.normal;
            const k = blastTimer / 40;
            ctx.fillStyle = 'rgba(255, 255, 255, ' + (0.7 * k) + ')';
            ctx.fillRect(0, 0, W, H);
            ctx.beginPath();
            ctx.arc(blastX, blastY, (1 - k) * 700 * kind.scale, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(' + kind.wave + ', ' + k + ')';
            ctx.lineWidth = 14 * kind.scale;
            ctx.stroke();
            if (kind.scale > 1) {
                ctx.beginPath();
                ctx.arc(blastX, blastY, (1 - k) * 480 * kind.scale, 0, Math.PI * 2);
                ctx.strokeStyle = 'rgba(' + kind.mid + ', ' + k + ')';
                ctx.lineWidth = 8 * kind.scale;
                ctx.stroke();
            }
        }

        // накопление энергии: шар растёт, частицы стекаются к центру
        if (blastCharge > 0) {
            const kind = blastKind || BLAST_KINDS.normal;
            const k = 1 - blastCharge / blastChargeMax;
            ctx.fillStyle = 'rgba(0, 0, 0, ' + (0.4 * k) + ')';
            ctx.fillRect(0, 0, W, H);
            const r = (6 + k * 42) * kind.scale;
            const pulse = 1 + 0.12 * Math.sin(blastCharge * 0.9);
            ctx.beginPath();
            ctx.arc(blastX, blastY, r * 1.7 * pulse, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(' + kind.outer + ', ' + (0.18 + 0.2 * k) + ')';
            ctx.fill();
            ctx.beginPath();
            ctx.arc(blastX, blastY, r * 1.2 * pulse, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(' + kind.mid + ', ' + (0.45 + 0.3 * k) + ')';
            ctx.fill();
            ctx.beginPath();
            ctx.arc(blastX, blastY, r * 0.7 * pulse, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
            ctx.fill();
            ctx.beginPath();
            ctx.arc(blastX, blastY, r * 2.1, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(' + kind.mid + ', ' + (0.5 * k) + ')';
            ctx.lineWidth = 2;
            ctx.stroke();
            const parts = kind.id === 'normal' ? 16 : 24;
            for (let i = 0; i < parts; i++) {
                const a = i * Math.PI * 2 / parts + k * 7;
                const pr = 12 + (1 - k) * 150 * kind.scale * (0.55 + 0.45 * ((i % 3) / 2));
                ctx.fillStyle = 'rgba(' + kind.mid + ', ' + (0.4 + 0.6 * k) + ')';
                ctx.beginPath();
                ctx.arc(blastX + Math.cos(a) * pr, blastY + Math.sin(a) * pr, 2.5, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        floatingTexts.forEach(function (t) { t.draw(); });
        drawBigArena();
        drawCutscene();
        ctx.restore();
        drawCutsceneUI();
        drawKokuUI();
        if (arenaFx > 55) {
            ctx.fillStyle = 'rgba(255, 255, 255, ' + ((arenaFx - 55) / 45 * 0.85) + ')';
            ctx.fillRect(0, 0, 500, 500);
        }
        // HUD рисуется в экранных координатах 500×500
        const sw = W, sh = H;
        W = 500; H = 500;
        drawHud();
        W = sw; H = sh;
        ctx.restore();
    }

    let lastTime = 0;
    let acc = 0;
    const STEP = 1000 / 60;

    function loop(t) {
        if (!running) return;
        if (!lastTime) lastTime = t;
        acc += Math.min(t - lastTime, 100);
        lastTime = t;
        while (acc >= STEP && running) {
            update();
            acc -= STEP;
        }
        draw();
        if (running) rafId = requestAnimationFrame(loop);
    }

    function checkEnd() {
        // выбывают: HP 0 (кроме «павшего» Автора, который ещё вернётся)
        // и стёртые шары, которые уже растворились
        balls.forEach(function (b) {
            if (b.out) return;
            if (b.hp <= 0 && !b.isFakeDead && !(b.erased && b.eraseTimer > 0)) {
                b.out = true;
                if (b.isCopy) return;
                floatingTexts.push(new FloatingText(b.x, b.y - 20, b.erased ? 'ERASED' : 'OUT', '255, 120, 120'));
                playExplosionSound();
            }
        });

        let alive = balls.filter(function (b) { return !b.out; });
        // копии Клона считаются одним бойцом: оставляем одного представителя на группу
        if (alive.some(function (b) { return b.isCopy; })) {
            const seen = new Set();
            alive = alive.filter(function (b) {
                if (!b.cloneGroup) return true;
                if (seen.has(b.cloneGroup)) return false;
                seen.add(b.cloneGroup);
                return true;
            });
        }
        if (isTeamMode()) {
            const livingTeams = Array.from(new Set(alive.map(function (b) { return b.team; })));
            if (livingTeams.length > 1) return;
            running = false;
            playerControls.style.display = 'none';
            stopBattleMusic();
            draw();
            if (livingTeams.length === 1) {
                const teamName = livingTeams[0] === 0 ? 'Team 1' : 'Team 2';
                const survivors = alive.map(function (b) { return b.name; }).join(' and ');
                resultText.textContent = teamName + ' wins! Remaining: ' + survivors;
            } else {
                resultText.textContent = 'Draw!';
            }
            setTimeout(function () { resultBox.style.display = 'flex'; }, 500);
            return;
        }
        // Робот и One Shot не дерутся: если остались только они — ничья
        if (alive.length >= 2 && alive.some(function (b) { return b.type === 'robot'; }) && alive.some(function (b) { return b.type === 'oneshot'; }) &&
            alive.every(function (b) { return b.type === 'robot' || b.type === 'oneshot'; })) {
            peaceT++;
            if (peaceT === 1) floatingTexts.push(new FloatingText(W / 2, H / 2 - 60, 'ROBOT AND ONE SHOT WILL NOT FIGHT', '255, 255, 255'));
            if (peaceT < 240) return;
            running = false;
            playerControls.style.display = 'none';
            stopBattleMusic();
            draw();
            resultText.textContent = 'Draw! Robot and One Shot refused to fight.';
            setTimeout(function () { resultBox.style.display = 'flex'; }, 500);
            return;
        }
        // Гоку и Вегета не дерутся: если остались только они — ничья
        if (alive.length >= 2 && alive.every(function (a) { return alive.every(function (b) { return a === b || (a.type !== b.type && (a.type === 'goku' || a.type === 'vegeta') && (b.type === 'goku' || b.type === 'vegeta')); }); })) {
            peaceT++;
            if (peaceT === 1) floatingTexts.push(new FloatingText(W / 2, H / 2 - 60, 'GOKU AND VEGETA WILL NOT FIGHT', '255, 255, 255'));
            if (peaceT < 240) return;
            running = false;
            playerControls.style.display = 'none';
            stopBattleMusic();
            draw();
            resultText.textContent = 'Draw! Goku and Vegeta refused to fight.';
            setTimeout(function () { resultBox.style.display = 'flex'; }, 500);
            return;
        }
        peaceT = 0;
        // если остались только союзники (Мегуми/Мегуна + Махорага) — победа хозяина
        if (alive.length > 1) {
            const leaders = alive.filter(function (b) { return b.type !== 'mahoraga'; });
            if (leaders.length === 1 && alive.every(function (b) {
                return b === leaders[0] || (b.type === 'mahoraga' && b.owner === leaders[0]);
            })) {
                // только один "главный" + его Махорага
            } else {
                return;
            }
        }

        running = false;
        playerControls.style.display = 'none';
        stopBattleMusic();
        draw();

        const winners = alive.filter(function (b) { return b.type !== 'mahoraga'; });
        if (winners.length === 1) {
            resultText.textContent = 'Winner: ' + winners[0].label + ' — ' + winners[0].name + '!';
        } else if (alive.length === 1) {
            resultText.textContent = 'Winner: ' + alive[0].label + ' — ' + alive[0].name + '!';
        } else {
            resultText.textContent = 'Draw!';
        }
        if (balls.some(function (b) { return b.erased; })) {
            resultText.textContent = 'Ball erased! ' + resultText.textContent;
        }
        setTimeout(function () { resultBox.style.display = 'flex'; }, 500);
    }


    // Сенсорный джойстик и способности TheFirstBlueGuy
    function updateJoystick(e) {
        const r = joystickBase.getBoundingClientRect();
        const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        let dx = e.clientX - cx, dy = e.clientY - cy;
        const max = 38, len = Math.hypot(dx, dy) || 1;
        if (len > max) { dx = dx / len * max; dy = dy / len * max; }
        playerMove.x = dx / max; playerMove.y = dy / max;
        joystickKnob.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
    }
    joystickBase.addEventListener('pointerdown', function(e) {
        playerMove.active = true; playerMove.pointerId = e.pointerId;
        joystickBase.setPointerCapture(e.pointerId); updateJoystick(e);
    });
    joystickBase.addEventListener('pointermove', function(e) {
        if (playerMove.active && e.pointerId === playerMove.pointerId) updateJoystick(e);
    });
    function releaseJoystick(e) {
        if (e.pointerId !== playerMove.pointerId) return;
        playerMove.active = false; playerMove.pointerId = null;
        playerMove.x = playerMove.y = 0; joystickKnob.style.transform = 'translate(0px, 0px)';
    }
    joystickBase.addEventListener('pointerup', releaseJoystick);
    joystickBase.addEventListener('pointercancel', releaseJoystick);
    document.getElementById('player-hit').addEventListener('click', function() {
        if (!playerCharacter || !running) return;
        const target = playerCharacter.nearestEnemy();
        if (target && Math.hypot(target.x-playerCharacter.x, target.y-playerCharacter.y) <= 75) {
            target.takeDamage(50, 'firstblue_punch');
            floatingTexts.push(new FloatingText(target.x, target.y-28, '−50 HP', '80, 210, 255'));
            playHitSound();
        } else floatingTexts.push(new FloatingText(playerCharacter.x, playerCharacter.y-30, 'GET CLOSER', '150, 220, 255'));
    });
    document.getElementById('player-laser').addEventListener('click', function() {
        if (!playerCharacter || !running) return;
        playerCharacter.playerLaserOn = !playerCharacter.playerLaserOn;
        const target = playerCharacter.nearestEnemy();
        if (target) playerCharacter.targetAngle = Math.atan2(target.y-playerCharacter.y, target.x-playerCharacter.x);
        this.textContent = playerCharacter.playerLaserOn ? 'LASER OFF' : 'BLUE LASER';
        playLaserSound();
    });
    document.getElementById('player-kill').addEventListener('click', function() {
        if (!playerCharacter || !running) return;
        playerCharacter.targets().forEach(function(t) {
            if (t.isGodTier()) { floatingTexts.push(new FloatingText(t.x, t.y-25, 'UNAFFECTED', '200, 200, 200')); return; }
            t.hp = 0; t.out = true;
            floatingTexts.push(new FloatingText(t.x, t.y-25, 'DESTROYED!', '80, 210, 255'));
        });
        playExplosionSound(); checkEnd();
    });

    /* ---------------- РЕЖИМ ГОНКИ ---------------- */
    // Гонщики бегут слева направо; у каждого есть скилл, дающий скорость (рывок, телепорт, ускорение)
    // или замедляющий соперников.
    let raceState = null;
    const RACE_LEN = 3000;
    const RACE_GO = 180; // 3 секунды обратного отсчёта
    // Спидстеры: у них есть пассивная сверхскорость (px/с). Если в гонке одни спидстеры — трасса 500 000 px
    const SPEEDSTER_PX = { naoya: 25000, wally: 21000, egor: 100000000, blackflash: 15000 };
    const SPEEDSTER_LEN = 500000;
    const EGOR_TET_FRAMES = 300;   // шаг тетрации Егора — каждые 5 секунд
    const EGOR_TET = [2, 4, 16, 65536];   // 2↑↑1 … 2↑↑4 (px/с); 2↑↑5 = 2^65536 не помещается в число — это финальный прыжок
    // Особые трассы для пар спидстеров (длина в px). Для «атомов» и «реальности» значения условные:
    // атомов во Вселенной ~10^80; в мультивселенной принято 10^200; «расстояние реальности» — 10^300 (предел double ≈ 1.8·10^308)
    const SPECIAL_TRACKS = {
        'egor,wally':           { len: 1e8,   name: '100 MILLION px' },
        'blackflash,wally':     { len: 1e80,  name: 'ATOMS IN THE UNIVERSE (10^80) px' },
        'blackflash,egor':      { len: 1e200, name: 'ATOMS IN THE MULTIVERSE (10^200) px' },
        'blackflash,egor,wally': { len: 1e300, name: 'THE DISTANCE OF REALITY (10^300) px' }
    };
    function fmtNum(n) {
        if (n < 1e6) return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
        const e = n.toExponential(2).split('e+');
        return e[0] + '×10^' + e[1];
    }

    function raceGod(r) { return r.type === 'thefirstblueguy' || r.type === 'muha1' || r.type === 'egor' || r.supreme; }   // Egor: «Отрицание» — любые эффекты соперников отрицаются
    function raceFx(r, text, col) { raceState.texts.push({ x: r.x, y: r.y - 34, text: text, col: col, life: 55 }); }
    function raceBoost(r, mul, frames, label, col) {
        r.boostMul = mul; r.boostT = frames; r.boostCol = col || '255, 235, 59';
        raceFx(r, label, r.boostCol);
        playChargeSound(0.15);
    }
    function raceBlink(r, dist, label, col) {
        for (let i = 0; i < 8; i++) r.trail.push({ x: r.x + i * dist / 8, life: 18 });
        r.x += dist; r.blinkFx = 14;
        raceFx(r, label, col || '180, 220, 255');
        playChargeSound(0.15);
    }
    function raceHitRivals(r, kind, frames, label, col) {
        raceState.racers.forEach(function (o) {
            if (o === r || raceGod(o)) return;
            if (kind === 'freeze') o.frozenT = Math.max(o.frozenT, frames);
            else if (kind === 'slow') o.slowT = Math.max(o.slowT, frames);
            else if (kind === 'stun') o.stunT = Math.max(o.stunT, frames);
        });
        raceFx(r, label, col || '200, 160, 255');
        playHitSound();
    }
    // тип → [название скилла, перезарядка (кадры), действие]
    const RACE_SKILLS = {
        blue:   ['Blue Jet', 230, function (r) { raceBoost(r, 2.2, 70, 'BLUE JET!', '64, 160, 255'); }],
        red:    ['Red Rocket', 230, function (r) { raceBoost(r, 2.4, 60, 'RED ROCKET!', '255, 90, 90'); }],
        green:  ['Green Rush', 220, function (r) { raceBoost(r, 2.0, 90, 'GREEN RUSH!', '90, 230, 120'); }],
        prism:  ['Light Speed', 300, function (r) { raceBlink(r, 230, 'LIGHT SPEED!', '0, 240, 255'); }],
        gojo:   ['Blink', 330, function (r) { raceBlink(r, 320, 'BLINK!', '144, 202, 249'); }],
        sukuna: ['Dismantle Dash', 250, function (r) { raceBoost(r, 2.3, 70, 'DISMANTLE DASH!', '230, 60, 60'); }],
        megumi: ['Shadow Step', 260, function (r) { raceBlink(r, 230, 'SHADOW STEP!', '120, 140, 160'); }],
        todo:   ['Boogie Woogie', 220, function (r) { raceBlink(r, 240, 'BOOGIE WOOGIE!', '255, 213, 79'); }],
        gblack: ['Time Ring Dash', 240, function (r) { raceBoost(r, 2.2, 70, 'DIVINE DASH!', '244, 143, 177'); }],
        vegeta: ['Galick Dash', 240, function (r) { raceBoost(r, 2.3, 70, 'GALICK DASH!', '171, 71, 188'); }],
        goku:   ['Instant Transmission', 240, function (r) { raceBlink(r, 260, 'INSTANT TRANSMISSION!', '255, 167, 38'); }],
        yuji:   ['Black Flash Dash', 250, function (r) { raceBoost(r, 2.4, 60, 'BLACK FLASH!', '255, 60, 60'); }],
        yuta:   ['Rika Rush', 270, function (r) { raceBoost(r, 2.5, 60, 'RIKA RUSH!', '121, 134, 203'); }],
        naoya:  ['Projection Frames', 260, function (r) { raceFx(r, '25 000 px/s!', '249, 168, 37'); }],
        timegod: ['Time Stop', 420, function (r) { raceHitRivals(r, 'freeze', 110, 'TIME STOP!', '255, 224, 130'); raceBoost(r, 1.6, 110, '', '255, 224, 130'); }],
        wally:  ['Speed Force', 240, function (r) { raceBoost(r, 1.5, 80, 'SPEED FORCE!', '255, 80, 60'); }],
        egor:   ['Tetration 2↑↑n', 1e9, function () {}],
        cosmic: ['Cosmic Warp', 450, function (r) { raceBlink(r, 430, 'COSMIC WARP!', '200, 120, 255'); }],
        oneshot: ['Serious Hops', 240, function (r) { raceBoost(r, 3.0, 60, 'SERIOUS HOPS!', '255, 230, 120'); }],
        robot:  ['Rocket Boosters', 300, function (r) { raceBoost(r, 2.6, 100, 'BOOSTERS!', '255, 152, 0'); }],
        author: ['Rewrite Track', 380, function (r) {
            raceBlink(r, 320, 'REWRITE TRACK!', '255, 213, 79');
            if (r.supreme) raceHitRivals(r, 'slow', 100, '[REDACTED]', '255, 255, 255');
        }],
        antiball: ['Anti-Field', 300, function (r) { raceHitRivals(r, 'slow', 90, 'ANTI-FIELD!', '255, 255, 255'); }],
        blackflash: ['Black Flash', 240, function (r) { raceBoost(r, 2.0, 50, 'BLACK FLASH!', '255, 60, 60'); }],
        ryu:    ['Hadou Dash', 250, function (r) { raceBoost(r, 2.4, 70, 'HADOU DASH!', '255, 140, 60'); }],
        scp096: ['RAGE', 500, function (r) { raceBoost(r, 3.8, 100, 'RAAAGE!', '255, 40, 40'); }],
        doubling: ['Double Speed', 150, function (r) { r.base += 0.35; raceBoost(r, 1.8, 40, 'SPEED ×2!', '255, 200, 60'); }],
        cloner: ['Clone Relay', 180, function (r) { r.base += 0.15; raceBlink(r, 150, 'CLONE RELAY!', '128, 222, 234'); }],
        muha1:  ['Buzz Dash', 150, function (r) { raceBoost(r, 3.2, 45, 'BZZT!', '178, 255, 89'); }],
        muha2:  ['Snap', 280, function (r) { raceHitRivals(r, 'stun', 70, 'SNAP!', '105, 240, 174'); raceBoost(r, 1.8, 60, '', '105, 240, 174'); }],
        thefirstblueguy: ['Blue Burst', 200, function (r) { raceBoost(r, 3.0, 80, 'BLUE BURST!', '22, 140, 255'); }]
    };
    const RACE_DEFAULT_SKILL = ['Sprint', 250, function (r) { raceBoost(r, 2.2, 60, 'SPRINT!', '255, 235, 59'); }];

    function startRace() {
        if (rafId) cancelAnimationFrame(rafId);
        W = 500; H = 500;
        cutscene = null; kokuScene = null; peaceT = 0; viewZoom = 1; arenaBroken = false;
        const list = fighters.slice(0, 3).filter(Boolean);
        const laneH = 78, y0 = 250 - (list.length - 1) * laneH / 2;
        const special = SPECIAL_TRACKS[list.map(function (f) { return f.type; }).sort().join(',')];
        const trackLen = special ? special.len : (list.every(function (f) { return SPEEDSTER_PX[f.type]; }) ? SPEEDSTER_LEN : RACE_LEN);
        // кресло Мёбиуса (Wally / Egor): скорость ×1000 — выбираем заранее, чтобы учесть в длительности гонки
        const chairs = list.map(function (f) {
            return (f.type === 'wally') && (f.chair === 'chair' || (f.chair !== 'normal' && Math.random() < 0.25));
        });
        // на гигантских трассах скорости масштабируются так, чтобы гонка длилась около минуты:
        // опорная скорость = самый быстрый гонщик (+10% Black Flash, ×2 Егор рядом с более быстрым, +10% на ускорения)
        let trackMul = 1;
        if (special) {
            let vRef = 0;
            list.forEach(function (f, i) { vRef = Math.max(vRef, (SPEEDSTER_PX[f.type] || 0) * (chairs[i] ? 1000 : 1)); });
            const hasBF = list.some(function (f) { return f.type === 'blackflash'; });
            const hasEg = list.some(function (f) { return f.type === 'egor'; });
            // темп гонки задают соперники Егора (он сам стартует с 2 px/с и догоняет тетрацией)
            let others = 0;
            vRef = 0;
            list.forEach(function (f, i) {
                if (f.type === 'egor') return;
                others++;
                vRef = Math.max(vRef, (SPEEDSTER_PX[f.type] || 0) * (chairs[i] ? 1000 : 1));
            });
            if (hasBF && others > 1) vRef *= 1.1;
            trackMul = trackLen / (60 * vRef * 1.1);
        }
        raceState = {
            t: 0, over: false, overT: 0, finish: [],
            len: trackLen, trackName: special ? special.name : null,
            wallyScene: list.some(function (f) { return f.type === 'egor'; }) && list.some(function (f) { return f.type === 'wally'; }),
            texts: [], camX: 0,
            racers: list.map(function (f, i) {
                const base = f.type === 'supauthor' ? 'author' : f.type;
                const chairOn = chairs[i];
                const sk = RACE_SKILLS[base] || RACE_DEFAULT_SKILL;
                return {
                    type: base, supreme: f.type === 'supauthor', name: f.name, color: f.color,
                    x: 40, y: y0 + i * laneH, v: 0, base: (SPEEDSTER_PX[base] ? SPEEDSTER_PX[base] / 60 * trackMul : 3.1 + Math.random() * 0.4) * (chairOn ? 1000 : 1), chair: chairOn,
                    boostT: 0, boostMul: 1, boostCol: '255, 235, 59',
                    frozenT: 0, slowT: 0, stunT: 0, blinkFx: 0, trail: [],
                    skill: sk, cd: 70 + Math.random() * 60, finished: false
                };
            })
        };
        running = true; lastTime = 0; acc = 0;
        rafId = requestAnimationFrame(loop);
    }

    function updateRace() {
        const rs = raceState;
        rs.t++;
        rs.texts.forEach(function (tx) { tx.life--; tx.y -= 0.5; });
        rs.texts = rs.texts.filter(function (tx) { return tx.life > 0; });
        if (rs.t < RACE_GO) return;
        rs.racers.forEach(function (r) {
            if (r.blinkFx > 0) r.blinkFx--;
            r.trail.forEach(function (p) { p.life--; });
            r.trail = r.trail.filter(function (p) { return p.life > 0; });
            if (raceGod(r)) { r.frozenT = 0; r.slowT = 0; r.stunT = 0; }
            let target = r.base;
            if (r.boostT > 0) { r.boostT--; target *= r.boostMul; }
            if (r.slowT > 0) { r.slowT--; target *= 0.2; }
            if (r.frozenT > 0) { r.frozenT--; target = 0; r.v = 0; }
            if (r.stunT > 0) { r.stunT--; target = 0; r.v *= 0.8; }
            r.v += (target - r.v) * 0.14;
            if (r.egDouble) r.v = Math.max(r.v, target);   // удвоение мгновенное, без разгона
            if (r.type === 'egor' && !r.surged) {
                // ТЕТРАЦИЯ: Egor стартует с 2 px/с и каждые 5 секунд делает шаг по башне степеней 2↑↑n:
                // 2 → 4 → 16 → 65 536 → 2↑↑5 (переполнение: 2^65536 px/с — больше любой трассы, мгновенный финиш).
                r.tetH = Math.min(5, 1 + Math.floor((rs.t - RACE_GO) / EGOR_TET_FRAMES));
                r.v = (EGOR_TET[r.tetH - 1] || 0) / 60;
                r.egAdapted = true;   // «Адаптация»: Black Flash больше не подстраивается под Егора
            }
        });
        // Black Flash адаптируется к скорости: всегда на 10% быстрее самого быстрого соперника
        rs.racers.forEach(function (r) {
            if (r.type !== 'blackflash') return;
            r.adapt = 0;
            if (r.frozenT > 0 || r.stunT > 0 || r.slowT > 0) return;
            let mx = 0;
            rs.racers.forEach(function (o) { if (o !== r && !o.finished && !(o.type === 'egor' && o.egAdapted)) mx = Math.max(mx, o.v); });
            if (r.v < mx * 1.1) { r.v = mx * 1.1; }
            if (mx > 0) r.adapt = 1;
        });
        rs.racers.forEach(function (r) {
            if (!r.finished) r.x += r.v;
            if (r.type === 'egor' && !r.surged && !r.finished && r.tetH >= 5) {
                // «Догнал Wally West на 0.000…0001% своей мощи»: мгновенно оказывается на финише
                r.surged = true; r.x = rs.len; r.v = 0;
                rs.texts.push({ x: r.x, y: r.y - 52, text: 'TETRATION: 2↑↑5 px/s', col: '178, 255, 89', life: 200 });
                if (rs.wallyScene) {
                    rs.texts.push({ x: r.x, y: r.y - 36, text: 'CAUGHT UP WITH WALLY WEST USING 0.000…0001% OF HIS POWER', col: '178, 255, 89', life: 200 });
                }
            }
            // скилл: когда готов — используем (если ещё не бежим к финишу вплотную)
            if (!r.finished && r.frozenT <= 0 && r.stunT <= 0) {
                r.cd--;
                if (r.cd <= 0 && r.x < rs.len - 120) {
                    r.skill[2](r, rs.racers);
                    r.cd = r.skill[1] * (0.85 + Math.random() * 0.3);
                }
            }
            if (!r.finished && r.x >= rs.len) {
                r.finished = true; r.x = rs.len;
                rs.finish.push(r);
                if (!rs.over) { rs.over = true; raceFx(r, 'FINISH!', '255, 255, 255'); }
            }
        });
        if (rs.over) {
            rs.overT++;
            if (rs.overT === 100) {
                running = false;
                const order = rs.racers.slice().sort(function (a, b) {
                    const af = rs.finish.indexOf(a), bf = rs.finish.indexOf(b);
                    if (af !== -1 || bf !== -1) return (af === -1 ? 99 : af) - (bf === -1 ? 99 : bf);
                    return b.x - a.x;
                });
                resultText.textContent = '🏁 ' + order[0].name + ' wins the race!' + (order[0].surged && rs.wallyScene ? ' (Egor caught up with Wally using 0.000…0001% of his power)' : (order[0].surged ? ' (Egor: tetration 2↑↑5)' : '')) + '  ' +
                    order.map(function (r, i) { return (i + 1) + '. ' + r.name; }).join('   ');
                drawRace();
                setTimeout(function () { resultBox.style.display = 'flex'; }, 400);
            }
        }
    }

    function drawRace() {
        const rs = raceState;
        ctx.clearRect(0, 0, W, H);
        ctx.fillStyle = '#14181d';
        ctx.fillRect(0, 0, W, H);
        // камера по X: показываем всю группу. Масштаб только по горизонтали (шары не уменьшаются),
        // на трассе 500 000 px он падает до долей процента — разрыв между гонщиками остаётся в кадре
        const lead = rs.racers.reduce(function (m, r) { return r.x > m ? r.x : m; }, 0);
        const last = rs.racers.reduce(function (m, r) { return r.x < m ? r.x : m; }, 1e12);
        const targetS = Math.max(1e-305, Math.min(1, 360 / Math.max(1, lead - last)));
        // масштаб: плавно при малых изменениях, мгновенно при скачке (иначе на гигантских трассах гонщики
        // на старте улетают за кадр, пока камера «догоняет»)
        const dLog = Math.log(targetS) - Math.log(rs.sc || 1);
        rs.sc = Math.abs(dLog) > 1.5 ? targetS : Math.exp(Math.log(rs.sc || 1) + dLog * 0.1);
        const sc = rs.sc, VW = W / sc;
        const wantC = Math.max(VW / 2 - 30 / sc, Math.min(rs.len + 120 / sc - VW / 2, (lead + last) / 2 + 40 / sc));
        rs.camC = (rs.camC === undefined || Math.abs(wantC - rs.camC) * sc > 250) ? wantC : rs.camC + (wantC - rs.camC) * 0.12;
        const cam = rs.camC - VW / 2;
        const SX = function (wx) { return (wx - cam) * sc; };
        const n = rs.racers.length, laneH = 78;
        const top = rs.racers[0].y - laneH / 2, bot = rs.racers[n - 1].y + laneH / 2;
        // дорожки
        for (let i = 0; i < n; i++) {
            ctx.fillStyle = i % 2 ? '#2b3138' : '#323a42';
            ctx.fillRect(0, rs.racers[i].y - laneH / 2, W, laneH);
        }
        ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2;
        ctx.setLineDash([16, 14]); ctx.lineDashOffset = (cam * sc) % 30;
        for (let i = 1; i < n; i++) {
            const ly = rs.racers[i].y - laneH / 2;
            ctx.beginPath(); ctx.moveTo(0, ly); ctx.lineTo(W, ly); ctx.stroke();
        }
        ctx.setLineDash([]);
        ctx.fillStyle = '#fff'; ctx.fillRect(0, top - 3, W, 3); ctx.fillRect(0, bot, W, 3);
        // отметки дистанции (шаг подбирается под длину трассы)
        const mag = Math.pow(10, Math.floor(Math.log10(rs.len / 10)));
        let step = mag;
        [1, 2, 5, 10].some(function (m) { step = mag * m; return rs.len / step <= 12; });
        ctx.font = '10px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(255,255,255,0.45)';
        for (let d = step; d < rs.len; d += step) {
            const sx = SX(d);
            if (sx < -20 || sx > W + 20) continue;
            ctx.fillRect(sx - 1, top - 12, 2, 9);
            ctx.fillText(d >= 1e6 ? fmtNum(d) : d >= 1000 ? (d / 1000) + 'k' : String(d), sx, top - 16);
        }
        // старт и финиш
        const sxs = SX(40);
        if (sxs > -10 && sxs < W) { ctx.fillStyle = '#fff'; ctx.fillRect(sxs - 14, top, 3, bot - top); }
        const fx = SX(rs.len);
        if (fx > -30 && fx < W + 30) {
            const sq = 10;
            for (let yy = top, row = 0; yy < bot; yy += sq, row++) {
                for (let c = 0; c < 2; c++) {
                    ctx.fillStyle = (row + c) % 2 ? '#fff' : '#111';
                    ctx.fillRect(fx + c * sq, yy, sq, Math.min(sq, bot - yy));
                }
            }
            ctx.fillStyle = '#ffeb3b'; ctx.font = 'bold 13px sans-serif'; ctx.fillText('FINISH', fx + sq, top - 16);
            ctx.fillStyle = '#1b3a1b'; ctx.fillRect(fx + 2 * sq, top, W, bot - top);
        }
        // гонщики
        rs.racers.forEach(function (r) {
            const sx = SX(r.x), R = 18;
            r.trail.forEach(function (p) {
                ctx.globalAlpha = p.life / 18 * 0.4; ctx.fillStyle = '#ffffff';
                ctx.beginPath(); ctx.arc(SX(p.x), r.y, R * 0.8, 0, Math.PI * 2); ctx.fill();
            });
            ctx.globalAlpha = 1;
            const fast = r.boostT > 0 && r.v > r.base * 1.3;
            if (fast) {
                ctx.strokeStyle = 'rgba(' + r.boostCol + ', 0.7)'; ctx.lineWidth = 2;
                for (let k = -2; k <= 2; k++) {
                    const ln = 24 + Math.random() * 40;
                    ctx.beginPath(); ctx.moveTo(sx - R - 4, r.y + k * 6); ctx.lineTo(sx - R - 4 - ln, r.y + k * 6); ctx.stroke();
                }
                ctx.beginPath(); ctx.arc(sx, r.y, R + 6, 0, Math.PI * 2);
                ctx.strokeStyle = 'rgba(' + r.boostCol + ', 0.9)'; ctx.stroke();
            }
            ctx.beginPath(); ctx.arc(sx, r.y, R, 0, Math.PI * 2);
            ctx.fillStyle = r.color; ctx.fill();
            ctx.lineWidth = 2; ctx.strokeStyle = r.supreme ? '#ffd54f' : '#fff'; ctx.stroke();
            if (r.frozenT > 0) { ctx.fillStyle = 'rgba(120,200,255,0.55)'; ctx.beginPath(); ctx.arc(sx, r.y, R + 2, 0, Math.PI * 2); ctx.fill(); }
            if (r.slowT > 0) { ctx.strokeStyle = 'rgba(190,120,255,0.9)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(sx, r.y, R + 5, 0, Math.PI * 2); ctx.stroke(); }
            ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.font = 'bold 11px sans-serif';
            const lx = Math.max(95, Math.min(W - 95, sx));
            ctx.fillText(r.name + (r.chair ? ' · MÖBIUS CHAIR ×1000' : '') + (r.type === 'egor' && r.tetH ? ' · 2↑↑' + r.tetH : ''), lx, r.y - R - 8);
            if (r.egDouble) {
                ctx.strokeStyle = 'rgba(178, 255, 89, 0.95)'; ctx.lineWidth = 3;
                ctx.beginPath(); ctx.arc(sx, r.y, R + 8, 0, Math.PI * 2); ctx.stroke();
                ctx.fillStyle = '#b2ff59'; ctx.fillText('DOUBLED ×' + r.egStacks, sx, r.y - R - 20); ctx.fillStyle = '#fff';
            }
            if (r.stunT > 0) ctx.fillText('★ ★ ★', lx, r.y - R - 20);
            if (r.frozenT > 0) ctx.fillText('FROZEN', lx, r.y + R + 14);
            else if (r.slowT > 0) ctx.fillText('SLOWED', lx, r.y + R + 14);
            else if (rs.t >= RACE_GO) ctx.fillText(fmtNum(r.v * 60) + ' px/s' + (r.adapt ? ' · ADAPT +10%' : ''), lx, r.y + R + 14);
        });
        // всплывающие тексты
        ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center';
        rs.texts.forEach(function (tx) {
            if (!tx.text) return;
            ctx.fillStyle = 'rgba(' + tx.col + ', ' + Math.min(1, tx.life / 25) + ')';
            ctx.fillText(tx.text, Math.max(40, Math.min(W - 40, SX(tx.x))), tx.y);
        });
        // мини-карта прогресса
        ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(10, 10, W - 20, 22);
        ctx.fillStyle = '#555'; ctx.fillRect(20, 20, W - 40, 3);
        ctx.fillStyle = '#ffeb3b'; ctx.fillRect(W - 22, 14, 3, 14);
        rs.racers.forEach(function (r) {
            ctx.beginPath(); ctx.arc(20 + (W - 40) * Math.min(1, r.x / rs.len), 21.5, 5, 0, Math.PI * 2);
            ctx.fillStyle = r.color; ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.stroke();
        });
        ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.font = '10px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(rs.trackName ? 'TRACK: ' + rs.trackName : 'TRACK ' + fmtNum(rs.len) + ' px × ' + fmtNum(rs.len) + ' px', W / 2, 46);
        // панель скиллов
        const bw = (W - 20 - (n - 1) * 8) / n;
        rs.racers.forEach(function (r, i) {
            const bx = 10 + i * (bw + 8), by = H - 44;
            ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(bx, by, bw, 34);
            const ready = r.cd <= 0 || rs.t < RACE_GO;
            const frac = rs.t < RACE_GO ? 1 : 1 - Math.max(0, r.cd) / (r.skill[1]);
            ctx.fillStyle = ready ? '#76ff03' : r.color; ctx.fillRect(bx + 4, by + 22, (bw - 8) * Math.max(0, Math.min(1, frac)), 6);
            ctx.fillStyle = '#fff'; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'left';
            ctx.fillText(r.name + ' — ' + r.skill[0], bx + 4, by + 14);
        });
        // обратный отсчёт
        if (rs.t < RACE_GO + 40) {
            const left = Math.ceil((RACE_GO - rs.t) / 60);
            ctx.font = 'bold 72px sans-serif'; ctx.textAlign = 'center';
            ctx.fillStyle = rs.t < RACE_GO ? '#fff' : 'rgba(118,255,3,' + (1 - (rs.t - RACE_GO) / 40) + ')';
            ctx.fillText(rs.t < RACE_GO ? String(left) : 'GO!', W / 2, 150);
        }
    }

    function startBattle() {
        const requiredCount = battleMode === 'race' ? 2 : battleMode === '2v2' ? 4 : (battleMode === '1v1v1' || battleMode === '2v1') ? 3 : 2;
        if (fighters.slice(0, requiredCount).some(function (f) { return !f; })) {
            alert('Select all ' + requiredCount + ' fighters for this mode!');
            return;
        }
        fighters.forEach(function (f, i) { if (f) f.chair = chairSel[i] || 'random'; });
        document.querySelectorAll('.mode-switch').forEach(function (b) { b.style.display = 'none'; });
        initAudio();
        stopBattleMusic();
        if (rafId) cancelAnimationFrame(rafId);

        menu.style.display = 'none';
        resultBox.style.display = 'none';
        canvas.style.display = 'block';
        playerControls.style.display = 'none';
        playerCharacter = null;
        playerMove.x = playerMove.y = 0;
        joystickKnob.style.transform = 'translate(0px, 0px)';
        raceState = null;
        if (battleMode === 'race') { startRace(); return; }

        floatingTexts = [];
        timeStopOwner = null;
        timeStopTimer = 0;
        contactCooldown = 0;
        blastTimer = 0;
        blastCharge = 0;
        blastBalls = [];
        blastKind = null;
        blastChargeMax = 80;
        clashRolled = {};
        domainClash = null;
        clashFlash = 0;
        W = 500; H = 500;
        cutscene = null; kokuScene = null; peaceT = 0;
        arenaBroken = false; arenaFx = 0; arenaBreakT = 0; arenaCracks = []; viewZoom = 1;

        // В 2v2 нужны все четыре выбранных бойца; в остальных режимах — первые 2 или 3.
        const roster = (battleMode === '2v2' ? fighters.slice(0, 4) : (battleMode === '1v1v1' || battleMode === '2v1') ? fighters.slice(0, 3) : fighters.slice(0, 2)).filter(Boolean).map(function (f) { return f.type === 'supauthor' ? Object.assign({}, f, { type: 'author', supreme: true }) : f; });
        // «система лазеров» есть у Синего, Красного, Prism и Автора
        const LASER_TYPES = ['blue', 'red', 'prism', 'author'];
        const laserTriangle = roster.length === 3 && battleMode !== '2v1' &&
            roster.every(function (f) { return LASER_TYPES.indexOf(f.type) !== -1; });

        let starts;
        if (laserTriangle) {
            // три лазерных бойца встают треугольником почти по центру арены
            const a0 = Math.random() * Math.PI * 2;
            starts = [0, 1, 2].map(function (i) {
                const a = a0 + i * Math.PI * 2 / 3;
                return [
                    W / 2 + Math.cos(a) * 85 + (Math.random() - 0.5) * 14,
                    H / 2 + Math.sin(a) * 85 + (Math.random() - 0.5) * 14
                ];
            });
        } else if (battleMode === '2v1') {
            starts = [[105, 170], [105, 330], [395, 250]];
        } else if (battleMode === '2v2') {
            starts = [[105, 170], [105, 330], [395, 170], [395, 330]];
        } else if (roster.length === 3) {
            starts = [[100, 380], [400, 380], [250, 120]];
        } else {
            starts = [[110, 250], [390, 250]];
        }

        balls = roster.map(function (f, i) {
            const label = isTeamMode() ? (i < 2 ? 'Team 1' : 'Team 2') : 'Fighter ' + (i + 1);
            chairForce = (f.type === 'wally' || f.type === 'egor') && f.chair !== 'random' ? f.chair : null;
            const b = new Ball(starts[i][0], starts[i][1], f.color, f.type, f.name, label);
            chairForce = null;
            b.team = isTeamMode() ? (i < 2 ? 0 : 1) : i;
            if (f.supreme) { b.supreme = true; b.hp = 300; }
            if (f.type === 'yuji') b.hp = 130;   // Юджи после Сибуя: крепче
            if (f.type === 'todo') b.hp = 120;
            if (f.type === 'goku') b.hp = 150;
            if (f.type === 'vegeta') b.hp = 150;
            if (f.type === 'gblack') b.hp = 250;
            return b;
        });

        // Если TheFirstBlueGuy выбран среди бойцов, передаём управление игроку
        // и показываем сенсорные элементы управления поверх арены.
        playerCharacter = balls.find(function (b) { return b.type === 'thefirstblueguy'; }) || null;
        if (playerCharacter) {
            playerCharacter.hp = 100;
            playerCharacter.dx = 0;
            playerCharacter.dy = 0;
            playerControls.style.display = 'block';
            playerControls.style.visibility = 'visible';
            playerControls.style.zIndex = '99999';
            document.getElementById('player-laser').textContent = 'BLUE LASER';
        } else {
            playerControls.style.display = 'none';
        }

        if (laserTriangle) {
            // короткая пауза, чтобы построение было видно
            balls.forEach(function (b) { b.holdTimer = 50; });
            floatingTexts.push(new FloatingText(W / 2, H / 2 - 120, 'LASER TRIANGLE', '255, 255, 255'));
        }

        running = true;
        lastTime = 0;
        acc = 0;
        rafId = requestAnimationFrame(loop);
    }
})();
