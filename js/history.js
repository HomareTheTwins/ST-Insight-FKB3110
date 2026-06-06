/*
 ST-Insight
 Copyright © Takashi SAITO
 無断転載・再配布禁止
*/

/* =====================================================
   得点履歴登録&イベントログ保存
   ・得点/失点の内容と選手名を履歴に保存
   ・ショット統計用の情報も保存（hand/course/missType/missResult）
   ===================================================== */
// function addHistory(type, name, player = null) {
function addHistory(eventData) {
	// eventDataから必要な情報を分割代入で取得（objectで受け取る形に変更）
	const {
		type,				// 履歴タイプ（例: 得点/失点/system）
		eventName,			// 履歴内容（例: サーブ/フォアハンド/ゲーム開始）
		player = null,		// 選手ID（例: A1/A2/B1/B2）★統計管理用

		hand = null,		// フォア/バック管理用（例: fore/back）★統計管理用
		course = null,		// コース管理用（例: ストレート/クロス/逆クロス/センター）★統計管理用

		missType = null,	// ミスの種類管理用（例: 凡ミス/攻めミス/押された）★統計管理用
		missResult = null,	// ミスの結果管理用（例: ネット/アウト/サイドアウト）★統計管理用

		// wind = null			// 風向きはstateから直接取得するので不要
	} = eventData

	// system表示用
	let playerName = ""

	// 選手名が必要な履歴タイプのみ選手名取得
	const needPlayerTypes = ["得点", "失点"]
	if (needPlayerTypes.includes(type)) {
		playerName = player || state.players[state.selectedPlayerId] || state.selectedPlayerId // ★選手IDから選手名を取得（例: A1 → 田中）. プレイヤーIDが見つからない場合はIDを表示
	}

	// 履歴追加
	state.history.push({
		type,				// 履歴タイプ（例: 得点/失点/system）
		eventName,			// 履歴内容（例: サーブ/フォアハンド/ゲーム開始）
		player: playerName,	// 履歴表示用の選手名（例: 田中）

		hand,				// フォア/バック管理用（例: fore/back）★統計管理用
		course,				// コース管理用（例: ストレート/クロス/逆クロス/センター）★統計管理用

		missType,			// ミスの種類管理用（例: 凡ミス/攻めミス/押された）★統計管理用
		missResult,			// ミスの結果管理用（例: ネット/アウト/サイドアウト）★統計管理用
		
		wind: state.wind,	// 風向きも履歴に保存

		time: Date.now()	// タイムスタンプ（必要に応じて） ★履歴の時間管理に活用できるかも
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
	   ショット統計　更新
	   1. ショット名の作成（例: ストローク（フォア））★hand情報も含める形に変更
	   2. 得点/失点でショット統計を更新
	   3. 表示中なら再描画
	   ========================= */
	// 初期化
	const playerId = state.selectedPlayerId	// ★選手IDを状態から取得（例: A1/A2/B1/B2）

	if (!state.shotStats[playerId]) {
		state.shotStats[playerId] = {
			shots: {}	// win / error管理
		}
	}

	// 集計用ショット名作成（例: ストローク（フォア））★hand情報も含める形に変更
	// ToDo★ 今後もしhand以外の情報も追加する可能性があるため、shotNameは統計管理用の名前として使用（履歴表示にはeventData.nameを使用）
	// 例: ストローク（フォア）/ ストローク（バック）/ ストローク（フォア/クロス）など
	const statShotName = hand ? `${eventName}（${hand}）` : eventName

	// 得点
	if (type === "得点") {
		if (!state.shotStats[playerId].shots[statShotName]) {
			state.shotStats[playerId].shots[statShotName] = { win: 0, error: 0 }
		}
		state.shotStats[playerId].shots[statShotName].win++
	}

	// 失点
	if (type === "失点") {
		if (!state.shotStats[playerId].shots[statShotName]) {
			state.shotStats[playerId].shots[statShotName] = { win: 0, error: 0 }
		}
		state.shotStats[playerId].shots[statShotName].error++
	}

	// 表示中なら再描画
	if (!document.getElementById("historyArea").classList.contains("hidden")) {
		renderHistory()
	}
}

/* =====================================================
   得点履歴表示
   ・得点/失点なら選手名＋内容表示
   ・type=systemならシステム文言表示（例: 各ゲーム/ファイナルゲーム）
   ・風向きは前回から変わったときのみ表示（得点/失点のみ）
   ===================================================== */
function renderHistory() {

	let area = document.getElementById("historyArea")

	let prevWind = null

	area.innerHTML = state.history.map(h => {
		// system履歴：ゲーム区切り
		if (h.type === "system") {
			prevWind = null // 風向きリセット

			return `=== ${h.eventName} ===`
		}

		// 通常履歴：選手名＋内容+風向き（風向きは前回から変わったときのみ表示）

		// 風向きラベルの取得（例: 追風 → ↑追風）★getWindLabel関数でラベルを取得する形に変更
		let windHtml = ""
		if (state.inputMode === "detail" && h.wind && h.wind !== prevWind) {
			windHtml = `<span class="windInline"> ${getWindLabel(h.wind)}</span>`
			prevWind = h.wind
		}

		// 表示用イベントラベルの取得（例: ストローク → ストローク（フォア））
		let displayEventLabel = h.eventName

		// hand情報がある場合は表示用イベントラベルにhand情報を追加（例: ストローク → ストローク（フォア））
		if (h.hand) {
			displayEventLabel += `（${h.hand}）`
		}

		// ミスタイプがある場合は表示用イベントラベルにミスタイプ情報を追加（例: ストローク（フォア） → ストローク（フォア）[凡ミス]）
		if(h.missType){
			displayEventLabel += `[${h.missType}]`
		}

		// 履歴行のHTMLを返す（例: 田中：得点-ストローク（フォア）【追風】）
		return `<span class="historyRow">
					<span class="historyMain">
						${h.player}：${h.type}-${displayEventLabel}
					</span>
						${windHtml}
					</span>
				`
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
		gameResults: state.gameResults,	// ゲームごとのスコアと勝者を記録する
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
	if (!state.historyStack?.length) return

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

	state.isFinalGame = prev.isFinalGame
	state.gameFinished = prev.gameFinished
	state.matchFinished = prev.matchFinished

	state.ui = prev.ui

	// 再描画（重要）
	updateUI()
}