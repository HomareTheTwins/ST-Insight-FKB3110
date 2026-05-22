/*
 ST-Insight
 Copyright © Takashi SAITO
 無断転載・再配布禁止
*/

/* =====================================================
   得点履歴登録
   ===================================================== */
function addHistory(type, name, player = null) {
	// system表示用
	let playerName = ""

	// 選手名が必要な履歴タイプのみ選手名取得
	const needPlayerTypes = ["得点", "失点"]
	if (needPlayerTypes.includes(type)) {
		playerName = player || state.players[state.selectedPlayerId] || state.selectedPlayerId // ★選手IDから選手名を取得（例: A1 → 田中）. プレイヤーIDが見つからない場合はIDを表示
	}

	// 履歴追加
	state.history.push({
		type: type,
		name: name,
		player: playerName,
		wind: state.wind,	// 風の状態を履歴に追加
		time: Date.now()
	})

	/* =========================
	   システム履歴＆環境履歴の場合は以下の処理で終了
	   ========================= */
	if (type === "system") {
		// 表示中なら再描画
		if (!document.getElementById("historyArea").classList.contains("hidden")) {
			renderHistory()
		}
		return
	}

	/* =========================
	   ショット統計
	   ========================= */
	// 初期化
	const playerId = state.selectedPlayerId	// ★選手IDを状態から取得（例: A1/A2/B1/B2）
	// playerNameは履歴表示用、playerIdは統計管理用（例: A1/A2/B1/B2）

	if (!state.shotStats[playerId]) {
		state.shotStats[playerId] = {
			shots: {}	// win / error管理
		}
	}

	// 得点
	if (type === "得点") {
		if (!state.shotStats[playerId].shots[name]) {
			state.shotStats[playerId].shots[name] = { win: 0, error: 0 }
		}
		state.shotStats[playerId].shots[name].win++
	}

	// 失点
	if (type === "失点") {
		if (!state.shotStats[playerId].shots[name]) {
			state.shotStats[playerId].shots[name] = { win: 0, error: 0 }
		}
		state.shotStats[playerId].shots[name].error++
	}

	// 表示中なら再描画
	if (!document.getElementById("historyArea").classList.contains("hidden")) {
		renderHistory()
	}
}

/* =====================================================
   得点履歴表示
   ・type=systemならシステム文言表示
   ===================================================== */
function renderHistory() {

	let area = document.getElementById("historyArea")

	let prevWind = null

	area.innerHTML = state.history.map(h => {
		// system履歴：ゲーム区切り
		if (h.type === "system") {
			prevWind = null // 風向きリセット

			return `=== ${h.name} ===`
		}

		// 通常履歴：選手名＋内容+風向き（風向きは前回から変わったときのみ表示）
		let windHtml = ""
		if (state.inputMode === "detail" && h.wind && h.wind !== prevWind) {
			windHtml = `<span class="windInline"> ${getWindLabel(h.wind)}</span>`
			prevWind = h.wind
		}
		return `<span class="historyRow"><span class="historyMain">${h.player}：${h.type}-${h.name}</span>${windHtml}</span>`
	}).join("")
}

/* =====================================================
   得点履歴押下処理
   ===================================================== */
function toggleHistory() {

	let area = document.getElementById("historyArea")

	area.classList.toggle("hidden")

	if (!area.classList.contains("hidden")) {
		renderHistory()
	}
}

/* =====================================================
   サーブ確率表示
   ===================================================== */
function renderServeStats() {

	let div = document.getElementById("statsArea")
	div.innerHTML = ""

	Object.keys(state.serveStats).forEach(p => {

		let playerName = state.players[p]

		// 選手名未入力は非表示
		if (!playerName) return

		// シングルス時は対象2人のみ表示
		if (state.isSingles) {
			if (playerName !== state.singleA && playerName !== state.singleB) {
				return
			}
		}

		let s = state.serveStats[p]

		let firstRate = s.firstTotal > 0 ? Math.round(s.firstIn / s.firstTotal * 100) : "-"
		let secondRate = s.secondTotal > 0 ? Math.round(s.secondIn / s.secondTotal * 100) : "-"

		let row = document.createElement("div")
		row.className = "stats-line"

		row.innerHTML = `
      <span class="name">${playerName}</span>
      <span class="stat">1st: ${firstRate}% (${s["firstIn"]}/${s["firstTotal"]})</span>
      <span class="stat">2nd: ${secondRate}% (${s["secondIn"]}/${s["secondTotal"]})</span>
    `
		div.appendChild(row)
	})
}

/* =====================================================
   サーブ確率押下処理
   ===================================================== */
function toggleStats() {

	let area = document.getElementById("statsArea")

	area.classList.toggle("hidden")

	if (!area.classList.contains("hidden")) {
		// サーブ後更新に変更　renderServeStats()
	}
}

/* =====================================================
   ショット確率集計
   ・個人
   ・ペア
   ・得点寄与率
   ===================================================== */
function shotStatistics() {

	let area = document.getElementById("shotStatsArea")
	if (!area) return

	area.innerHTML = ""

	// =========================
	// ヘッダー
	// =========================
	// 全ショット表示ボタン
	let headerRow = document.createElement("div")
	headerRow.className = "shot-header-row"

	let title = document.createElement("div")
	title.textContent = "ショット集計"
	title.className = "shot-title"

	let toggleBtn = document.createElement("button")
	toggleBtn.className = "shot-toggle-btn"

	toggleBtn.textContent = state.ui.showAllShots
		? "上位表示に戻す"
		: "全ショット表示"

	// ボタン押下で全表示と上位表示を切り替え
	toggleBtn.onclick = () => {
		state.ui.showAllShots = !state.ui.showAllShots
		shotStatistics() // 再描画
	}

	headerRow.appendChild(title)
	headerRow.appendChild(toggleBtn)
	area.appendChild(headerRow)

	// =========================
	// 集計
	// =========================
	let teamTotals = {
		A: { win: 0, error: 0 },
		B: { win: 0, error: 0 }
	}

	let playerStats = {}

	// ===== 集計（安全版） =====
	for (let player in (state.shotStats || {})) {

		let raw = state.shotStats[player] || {}
		let shots = raw.shots || {}

		// ★ チーム判定（安全）
		const team = player.startsWith("A") ? "A" : "B"

		let totalWin = 0
		let totalError = 0
		let shotArray = []

		// ★ shotsが空でもOK
		for (let shot in shots) {

			let s = shots[shot] || { win: 0, error: 0 }

			let w = s.win || 0
			let e = s.error || 0

			totalWin += w
			totalError += e

			let total = w + e
			let rate = total > 0 ? Math.round(w / total * 100) : 0

			shotArray.push({
				name: shot,
				win: w,
				error: e,
				rate: rate,
				total: total
			})
		}

		shotArray.sort((a, b) => b.total - a.total)

		playerStats[player] = {
			shots: shotArray,
			win: totalWin,
			error: totalError,
			team: team
		}

		teamTotals[team].win += totalWin
		teamTotals[team].error += totalError
	}

	// ===== 表示（個人） =====
	let order = ["A1", "A2", "B1", "B2"]	// 表示順固定

	order.forEach(player => {

		let ps = playerStats[player];
		if (!ps) return;

		let wrapper = document.createElement("div");
		wrapper.className = "shot-player";

		// ===== ヘッダー（クリック部分） =====
		let header = document.createElement("div");
		header.className = "toggle-header";
		header.classList.add(player.startsWith("A") ? "teamA" : "teamB");

		let isOpen = state.ui.openPlayers[player] ?? true;

		header.innerHTML = `
			<span>${state.players[player] || player}</span>
			<span class="toggle-icon">${isOpen ? "▼" : "▶"}</span>
		`;

		// ===== コンテンツ =====
		let content = document.createElement("div");
		content.style.display = isOpen ? "block" : "none";

		header.onclick = () => {
			let current = state.ui.openPlayers[player] ?? true;
			let next = !current;

			state.ui.openPlayers[player] = next;

			content.style.display = next ? "block" : "none";
			header.querySelector(".toggle-icon").textContent = next ? "▼" : "▶";
		};

		// ===== 成功率 =====
		let title1 = document.createElement("div");
		title1.innerHTML = "【ショット成功率】<small>※ 成功 /（成功＋ミス）</small>";
		content.appendChild(title1);

		let shots = Array.isArray(ps.shots) ? ps.shots : [];
		let limit = shotStatsConfig?.showTopN ?? 5;

		let displayShots = state.ui.showAllShots
			? shots
			: shots.slice(0, limit);

		if (!Array.isArray(displayShots)) return;

		displayShots.forEach((s, i) => {

			let color = "";

			if (shotStatsConfig?.enableColor) {
				if (s.rate >= 70) color = shotStatsConfig.color.high;
				else if (s.rate >= 50) color = shotStatsConfig.color.mid;
				else color = shotStatsConfig.color.low;
			}

			let bold = (i === 0 && shotStatsConfig.highlightBest)
				? "font-weight:bold;"
				: "";

			let line = document.createElement("div");
			line.innerHTML = `
				<span style="color:${color};${bold}">
				${s.name}：${s.rate}% (${s.win}/${s.total})
				</span>
			`;

			content.appendChild(line);
		});

		wrapper.appendChild(header);
		wrapper.appendChild(content);
		area.appendChild(wrapper);
	});

	// ===== ペア分析 =====
	if (!state.isSingles) {
		let pairDiv = document.createElement("div")
		pairDiv.className = "shot-pair"

		// ===== ヘッダー =====
		let header = document.createElement("div")
		header.className = "toggle-header"
		header.classList.add("pair-header");

		let isOpen = state.ui.openPair

		header.innerHTML = `
			<span>ペア分析</span>
			<span class="toggle-icon">${isOpen ? "▼" : "▶"}</span>
		`

		// ===== コンテンツ =====
		let content = document.createElement("div")

		content.style.display = isOpen ? "block" : "none"

		header.onclick = () => {
			state.ui.openPair = !state.ui.openPair
			content.style.display = state.ui.openPair ? "block" : "none"
			// アイコン更新
			header.querySelector(".toggle-icon").textContent = state.ui.openPair ? "▼" : "▶"
		}

			;["A", "B"].forEach(team => {

				// let members = Object.keys(playerStats).filter(p => p.startsWith(team))
				const order = team === "A" ? ["A1","A2"] : ["B1","B2"];

				const teamLabel = order
					.filter(p => playerStats[p])
					.map(p => state.players[p] || p)
					.join("＆");

				content.innerHTML += `
					<div style="
						margin-top:14px;
						padding:6px 0;
						border-top:1px solid #ddd;
						font-weight:bold;
					">
					【${teamLabel}】
					</div>
				`;

				// ===== 得点寄与 =====
				content.innerHTML += "<div>■ 得点寄与</div>"

				order.forEach(p => {
					let ps = playerStats[p]
					if (!ps) return;

					let winRate = teamTotals[team].win
						? Math.round(ps.win / teamTotals[team].win * 100)
						: 0

					content.innerHTML += `${state.players[p] || p}：${winRate}%<br>`
				})

				// ===== ミス寄与 =====
				content.innerHTML += "<div style='color:#aaa'>■ ミス寄与</div>"

				order.forEach(p => {
					let ps = playerStats[p]
					if (!ps) return;
					
					let errRate = teamTotals[team].error
						? Math.round(ps.error / teamTotals[team].error * 100)
						: 0

					content.innerHTML += `<span style="color:#aaa">${state.players[p] || p}：${errRate}%</span><br>`
				})
			})

		pairDiv.appendChild(header)
		pairDiv.appendChild(content)
		area.appendChild(pairDiv)
	}
}

/* =====================================================
   ショットスタッツ更新・表示
   ・リアルタイム表示
   ===================================================== */
function updateShotStats() {

	if (state._renderLock) return
	state._renderLock = true

	requestAnimationFrame(() => {
		shotStatistics()
		state._renderLock = false
	})
}

/* =====================================================
   ショット確率押下処理
   ===================================================== */
function toggleShotStats() {

	let area = document.getElementById("shotStatsArea")

	area.classList.toggle("hidden")

	if (!area.classList.contains("hidden")) {
		//shotStatistics()	// 得点後に更新ならコメントアウト★
	}
}

function pushState() {

	// state丸ごとコピー（深いコピー）
	const snapshot = JSON.parse(JSON.stringify({

		players: state.players,
		settings: state.settings,	// ★いる？

		score: state.score,
		gameResults: state.gameResults,
		history: state.history,

		shotStats: state.shotStats,
		serveStats: state.serveStats,
		receiveStats: state.receiveStats,

		selectedPlayerId: state.selectedPlayerId,

		service: state.service,
		serverRotation: state.serverRotation,
		serveIndex: state.serveIndex,
		is1stServe: state.is1stServe,
		currentServer: state.currentServer,
		serveTurnCount: state.serveTurnCount,

		isFinalGame: state.isFinalGame,
		gameFinished: state.gameFinished,
		matchFinished: state.matchFinished,

		ui: state.ui
	}))

	state.historyStack.push(snapshot)

	// 上限（任意）
	if (state.historyStack.length > 100) {
		state.historyStack.shift()
	}
}

function undo() {
	if (!state.historyStack.length) return

	const prev = state.historyStack.pop()
	if (!prev) return

	// ★ 深く戻す
	state.players = prev.players
	state.settings = prev.settings

	state.score = prev.score
	state.gameResults = prev.gameResults
	state.history = prev.history

	state.shotStats = prev.shotStats
	state.serveStats = prev.serveStats
	state.receiveStats = prev.receiveStats

	state.selectedPlayerId = prev.selectedPlayerId

	state.service = prev.service
	state.serverRotation = prev.serverRotation
	state.serveIndex = prev.serveIndex
	state.is1stServe = prev.is1stServe
	state.currentServer = prev.currentServer
	state.serveTurnCount = prev.serveTurnCount

	state.isFinalGame = prev.isFinalGame,
		state.gameFinished = prev.gameFinished,
		state.matchFinished = prev.matchFinished

	state.ui = prev.ui

	// 再描画（重要）
	updateUI()
}