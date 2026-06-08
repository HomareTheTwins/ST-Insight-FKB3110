/*
 ST-Insight
 Copyright © Takashi SAITO
 無断転載・再配布禁止
*/

// アプリ名
const APP_NAME = "ST-Insight"

// バージョン情報
const APP_VERSION = "v0.34-Beta"	// service-workerのバージョンと合わせる

// フォア/バック不要ショット
const noHandShots = new Set([
	"サービスエース",
	"フォルト",
	"ダブルフォルト"
])

/* =====================================================
   試合開始処理
   ・設定画面の入力値をstateに保存
   ・シングルス／ダブルス判定
   ・スコアボード、選手ボタン、得点ボタンを初期化
   ===================================================== */
function startMatch(){
	// UI関連フラグ初期化
	initUIState()
	
	/* 試合関連フラグ初期化 */
	initMatchState()
	
	// ① 生データ取得（ここではまだstateに入れない）
	const A1 = document.getElementById("A1").value.trim();
	const A2 = document.getElementById("A2").value.trim();
	const B1 = document.getElementById("B1").value.trim();
	const B2 = document.getElementById("B2").value.trim();

	// ② 空チェックして人数カウント
	const Acount = (A1 !== "" ? 1 : 0) + (A2 !== "" ? 1 : 0);
	const Bcount = (B1 !== "" ? 1 : 0) + (B2 !== "" ? 1 : 0);
	
	// シングルス判定
	state.isSingles=(Acount==1 && Bcount==1)
	
	// 選手確定
	if (state.isSingles) {
	  // シングルス：2人だけ確定
	  const A = A1 || A2;
	  const B = B1 || B2;

	  state.players = {
	    A1: A || "A1",
	    B1: B || "B1"
	  };
	} else {
	  // ダブルス：4人構造
	  state.players = {
	    A1: A1 || "A1",
	    A2: A2 || "A2",
	    B1: B1 || "B1",
	    B2: B2 || "B2"
	  };
	}
	
	// ゲーム数
	state.settings.games=parseInt(
		document.querySelector("input[name='games']:checked").value
	)

	// サービス権取得
	state.service=document.querySelector("input[name='serve']:checked").value
	
	// シングル選手設定
	if(state.isSingles){
		state.singleA=state.players.A1 || state.players.A2
		state.singleB=state.players.B1 || state.players.B2
	}
	
	// サービス順作成
	buildServerRotation()
	
	// 設定&バージョン情報非表示
	document.getElementById("setup").classList.add("hidden")
	document.getElementById("appInfo").classList.add("hidden")
	
	// 試合開始後画面表示
	document.getElementById("match").classList.remove("hidden")

	const btn = document.getElementById("undoBtn")
	if(btn){
		btn.addEventListener("click", undo)
	}
	
	createScoreboard()
	initPlayers()
	
	/* 画面戻す */
	updateUI()
	
	// 得点履歴にゲーム数出力
	addHistory({
		type: "system",
		eventName: `1ゲーム目`
	})
}

/* =====================================================
   選手ボタン初期化
   ・選手名表示
   ・クリックイベント設定
   ・シングルス時は不要ボタン非表示
   ===================================================== */
function initPlayers(){
	let ids=["A1","A2","B1","B2"]

	ids.forEach(id=>{
		let btn=document.getElementById("btn"+id)

		btn.innerText=state.players[id]||"-"

		btn.onclick=()=>selectPlayer(id)

		if(id.startsWith("A")) btn.classList.add("teamA")
		if(id.startsWith("B")) btn.classList.add("teamB")
	})

	if(state.isSingles){
		if(!state.players.A1) document.getElementById("btnA1").style.display="none"
		if(!state.players.A2) document.getElementById("btnA2").style.display="none"
		if(!state.players.B1) document.getElementById("btnB1").style.display="none"
		if(!state.players.B2) document.getElementById("btnB2").style.display="none"
	}

	// 試合開始時のデフォルト選択選手
	selectPlayer(state.service==="A"?"A1":"B1")
}

/* =====================================================
	ショット入力処理
	・ショット名と得点/失点の情報をstate.pendingShotに一時保存
	・フォア/バック選択UI表示
	・今後コースや結果の選択も追加する場合はここでstate.pendingShotに情報を追加していく★
   ===================================================== */
function handleShotInput(name,type){

	// 対象外 → 即処理
	if(noHandShots.has(name)){

		if(type==="得点"){
			recordShot(name)
		}else{
			recordError(name)
		}

		return
	}

	// 一時保存
	state.pendingShot = {
		name:name,		// ショット名
		type:type,		// 得点 or 失点
		hand:null,		// フォア/バックは後で選択
		missType:null	// ミスの種類（凡ミス/攻めミス/押し負け）※失点のみ
	}

	// フォア/バック選択UI表示
	showHandChoice()
}

/* =====================================================
   フォア/バック確定処理
   ===================================================== */
function selectHand(hand){

	if(!state.pendingShot) return

	if(state.pendingShot.type==="得点"){
		recordShot(state.pendingShot.name, hand)
	}else{
		state.pendingShot.hand = hand	// ミスのショットにhand情報も追加してからrecordError呼び出す

		// 詳細モードの場合はミスタイプ選択UI表示（ミスタイプ選択後にrecordError呼び出す）
		if(state.inputMode === "detail"){
			showMissTypeChoice()	// ミスタイプ選択UI表示（ミスタイプ選択後にrecordError呼び出す）
			return
		}

		// 簡易モードの場合はミスタイプ選択なしでrecordError呼び出す
		recordError(state.pendingShot.name, hand)
	}

	state.pendingShot = null

	removeHandChoice()
}

// キャンセル
function cancelHand(){

	state.pendingShot = null

	removeHandChoice()
	
	createShotButtons()
}

/* =====================================================
	ミスの種類選択処理
	・recordError呼び出し
	・選択UI削除
	===================================================== */
function selectMissType(missType){

	state.pendingShot.missType = missType

	recordError(
		state.pendingShot.name,
		state.pendingShot.hand,
		missType
	)

	state.pendingShot = null

	removeMissTypeChoice()
	removeHandChoice()
}

/* =====================================================
   得点入力処理
   ・選択選手のチームにポイント加算
   ・スコア更新とゲーム判定
   ・サービス権の更新
   ===================================================== */
function recordShot(shotName, hand = null){
	// Undo用
	pushState()

	let playerId = state.selectedPlayerId
	let team=state.selectedPlayerId.startsWith("A")?"A":"B"
	let server = getCurrentServer()
	
	// ===== スコア更新 =====
	if(team==="A") state.score.pointA++
	else state.score.pointB++
	
	updateServeButton()	// フォルトボタン更新

	// 得点履歴追加
	addHistory({
		type: "得点",
		eventName: shotName,
		hand: hand
	})
	
	// サーブのカウントアップ
	if(state.is1stServe){
	    state.serveStats[server].firstTotal++
	    state.serveStats[server].firstIn++
	}else{
	    state.serveStats[server].secondTotal++
	    state.serveStats[server].secondIn++
	}
	
	// 得点更新
	updatePoints()
	
	// 1ゲーム終了確認
	checkGame()
		
	state.is1stServe = true
	
	if(!state.gameFinished){
		advanceServer()
	}else{
		// ゲーム終了なのでインデックス初期化
		state.serveIndex = 0
	}
	
	// UI更新
	updateUI()
}


/* =====================================================
   ミスショット処理
   ===================================================== */
function recordError(errorName, hand = null, missType = null){
	// Undo用
	pushState()

	let scoredTeam=state.selectedPlayerId.startsWith("A")?"B":"A"
	let server = getCurrentServer()
	let selectedPlayerId = state.selectedPlayerId
	
	// ===== スコア更新（内部）=====
	if(scoredTeam==="A"){
		state.score.pointA++
	}else{
		state.score.pointB++
	}
	
	// ===== サーブ統計 =====
	// フォルト後の失点
	if(!state.is1stServe){
		// 選択中の選手がサーバー
		if(server == selectedPlayerId){
			// ダブルフォルト以外の失点（ダブルフォルトはserveFault()で加算する）
			if(!(errorName === "ダブルフォルト")){
				state.serveStats[server].secondTotal++
				state.serveStats[server].secondIn++
			}
		// 他の選手のミス
		}else{
			state.serveStats[server].secondTotal++
			state.serveStats[server].secondIn++
		}
		
	// フォルト以外の失点(1st入ってる)
	}else{
	    state.serveStats[server].firstTotal++
	    state.serveStats[server].firstIn++
	}
	
	// ===== レシーブ統計 =====
	let isServer =
	(state.selectedPlayerId.startsWith("A") && state.service==="A") ||
	(state.selectedPlayerId.startsWith("B") && state.service==="B")
	
	let player = state.selectedPlayerId
	let serveStats = state.serveStats[player]
	let receiveStats = state.receiveStats[player]
	if(isServer){
		// サーブの場合はフォルト処理内で加算
	}else{
	    receiveStats.receiveTotal++
	}
	
	// ポイント更新
	updatePoints()
	
	// 履歴追加
	addHistory({
		type: "失点",
		eventName: errorName,
		hand,					// ミスのショットにhand情報も追加
		missType				// ミスタイプ（凡ミス/攻めミス/押し負け）も追加
	})

	// 1ゲーム終了確認
	checkGame()

	state.is1stServe=true
	// ===== サーバー更新 =====
	if(!state.gameFinished){
		advanceServer()
	}else{
		// ゲーム終了なのでインデックス初期化
		state.serveIndex = 0
	}
	
	// ===== サーブ状態リセット =====
	updateServeButton()	// フォルトボタン更新
	
	// UI更新
	updateUI()
}


/* =====================================================
   ゲーム取得判定
   ・通常ゲーム
   ・ファイナルゲーム(7ポイント)
   ・得点履歴にゲーム数出力
   ===================================================== */
function checkGame(){
	if(state.isFinalGame){
		// ファイナルゲーム終了判定
		// Aの勝利
		if(state.score.pointA>=7 && state.score.pointA-state.score.pointB>=2){
			winGame("A")
			state.gameFinished = true
			
		// Bの勝利
		}else if(state.score.pointB>=7 && state.score.pointB-state.score.pointA>=2){
			winGame("B")
			state.gameFinished = true
			
		// ゲーム継続中
		}else{
			state.gameFinished = false
			// ボタンの更新
			createShotButtons()
		}
		return
	}

	// 以下ファイナルゲームではない場合
	let a=state.score.pointA
	let b=state.score.pointB

	if(a>=4 && a-b>=2){
		winGame("A")
		state.gameFinished = true

	}else if(b>=4 && b-a>=2){
		winGame("B")
		state.gameFinished = true
		
	// ゲーム継続中
	}else{
		state.gameFinished = false
	}

	// ゲーム数を得点履歴に表示
	if(state.gameFinished && !state.matchFinished && !state.isFinalGame){
		addHistory({
			type: "system",
			eventName: `${state.score.currentGame}ゲーム目`
		})
	}

	if(!state.matchFinished){
		// ボタンの更新
		createShotButtons()
	}
	return
}


/* =====================================================
	ゲーム終了時の処理
	・勝利チームのゲーム数を加算
	・該当ゲームセルに勝利色(win)を付与
	・GAME列の表示を更新
	・ポイントをリセット
	・現在ゲーム番号を次へ進める
	・サービス権を交代
	・サーバーマーク更新
	・現在ゲームのハイライト更新
	・試合終了判定(checkGameSet)を実行
   ===================================================== */
function winGame(team){
	let g=state.score.currentGame
	
	// スコア更新
	state.gameResults.push({ 
		aPoints: state.score.pointA,
		bPoints: state.score.pointB,
		winner: team
	})	// 勝者とそのゲームのポイントも記録するように変更
	const gameA = getGameCount("A")
	const gameB = getGameCount("B")

	// ファイナルゲーム判定
	state.isFinalGame = (
		gameA == Math.floor(state.settings.games/2) &&
		gameB == Math.floor(state.settings.games/2)
	)

	// ファイナルゲーム時、得点履歴にその旨表示
	if(state.isFinalGame){
		addHistory({
			type: "system",
			eventName: "ファイナルゲーム"
		})
	}

	// 1ゲーム終了のため初期化
	state.score.pointA=0
	state.score.pointB=0
	state.score.currentGame++

	// サービス権更新
	state.service=state.service === "A" ? "B" : "A"
	buildServerRotation()

	checkGameSet()
}

/* =====================================================
	試合終了判定処理

	・規定ゲーム数の過半数を取得しているか確認
	・試合終了の場合
	    - GAME列をmatchEndの指定色（黄色）でハイライト
	    - 現在ゲームのハイライトを解除
	    - 試合終了フラグをON
	    - 「試合終了」アラート表示
	    - 得点入力ボタンを無効化
	    - 「次の試合」ボタンを表示
===================================================== */
function checkGameSet(){
	const win=Math.floor(state.settings.games/2)+1

	const gameA = getGameCount("A")
	const gameB = getGameCount("B")
	if(gameA>=win || gameB>=win){
		const winner = gameA >= win ? "A" : "B"
		finishMatch(winner)
	}
	// if(state.score.gameA>=win || state.score.gameB>=win){
	// 	const winner = state.score.gameA >= win ? "A" : "B"
	// 	finishMatch(winner)
	// }
}

/* =====================================================
	試合終了処理

	・試合終了フラグをON
	・スコアボードの現在ゲーム列を黄色でハイライト
	・現在ゲームのハイライトを解除
	・「試合終了」アラート表示
	・得点入力ボタンを無効化
	・「次の試合」ボタンを表示
===================================================== */
function finishMatch(winner){

	state.matchFinished = true;
	
	updateUI()

	alert("試合終了");	// ★ToDo 将来、勝利チームとスコアを表示するように変更
}

/* =====================================================
	次の試合開始準備処理

	・試合終了フラグをOFF
	・スコア状態(point / game / currentGame)をリセット
	・試合画面を非表示
	・試合設定画面を表示
	・「次の試合」ボタンを再度非表示
===================================================== */
function nextMatch(){

	/* 画面戻す */
	document.getElementById("match").classList.add("hidden")
	document.getElementById("setup").classList.remove("hidden")
	document.getElementById("appInfo").classList.remove("hidden")

	/* ボタン戻す */
	document.getElementById("nextMatchBtn").classList.add("hidden")

	/* 選手ボタン再有効化 */
	document.querySelectorAll(".playerBtn").forEach(b=>{
		b.disabled=false
	})
}

/* =====================================================
	風向き変更処理
	・風向きは詳細モードでのみ表示
	・風向き変更をstateに保存
	・得点入力のタイミングで履歴に出力するためのフラグをON
====================================================== */
function changeWind(btn,wind){
	// 同じ風なら何もしない
	if(state.wind === wind) return

	// 状態更新
	state.wind = wind

	// 風向き未出力フラグON
	state.pendingWindLog = true

	// active解除
	document.querySelectorAll(".windBtn").forEach(b=>{
		b.classList.remove("activeWind")
	})

	// 押下ボタン強調
	btn.classList.add("activeWind")

	// 風向きは得点入力のタイミングで履歴に出力する
	// addHistory({
	// 	type: "wind",
	// 	eventName: `【風向き：${wind}】`
	// })
}

// 風向きラベル取得	
function getWindLabel(wind){

	switch(wind){

		case "追風":
			return "↑追風"

		case "向風":
			return "↓向風"

		case "左風":
			return "→左風"

		case "右風":
			return "←右風"

		case "無風":
			return "◯無風"

		default:
			return wind
	}
}

/* =====================================================
	ゲームカウント取得処理
   ===================================================== */
   function getGameCount(team){
	return state.gameResults.filter(game => game.winner === team).length
}

/* =====================================================
   アプリの状態保存
   ===================================================== */
function saveState(){

	localStorage.setItem(
		"stInsightState",
		JSON.stringify({

			players: state.players,
			isSingles: state.isSingles,
			singleA: state.singleA,
			singleB: state.singleB,

			settings: state.settings,

			score: state.score,
			gameResults: state.gameResults,

			selectedPlayerId: state.selectedPlayerId,

			service: state.service,
			serverRotation: state.serverRotation,
			serveIndex: state.serveIndex,
			is1stServe: state.is1stServe,
			currentServer: state.currentServer,

			isFinalGame: state.isFinalGame,

			history: state.history,
			historyStack: state.historyStack,	// ★リロード後のundo用に履歴も保存

			serveStats: state.serveStats,
			receiveStats: state.receiveStats,
			shotStats: state.shotStats,

			gameFinished: state.gameFinished,
			matchFinished: state.matchFinished,

			inputMode: state.inputMode,

			wind: state.wind,
			pendingWindLog: state.pendingWindLog
		})
	)
}

/* =====================================================
   アプリの状態復元
   ===================================================== */
function loadState(){

	const savedState = localStorage.getItem("stInsightState")

	if(!savedState) return

	const parsedState =	JSON.parse(savedState)

	Object.assign(state, parsedState)
}

/* =====================================================
   試合リセット処理
   ・ローカルストレージの状態を削除してリロード
   ・コンソールでstateを直接リセットする場合は以下のコードを実行
   ===================================================== */
function resetMatch(){
	localStorage.removeItem("stInsightState");
	location.reload();
}
function getSaveSize(){
	return JSON.stringify(state).length
}

function confirmFinishMatch(){

	const ok = confirm(
		"試合を終了しますか？"
	)

	if(!ok) return

	finishMatchFlow()
}

function finishMatchFlow(){

	localStorage.removeItem("stInsightState")

	location.reload()
}

function setupEventHandlers(){
	// ここにイベントハンドラ設定コードをまとめる（例: ボタンクリックなど）
	const undoBtn = document.getElementById("undoBtn")
	if(undoBtn){
		undoBtn.addEventListener("click", undo)
	}

	const finishMatchBtn = document.getElementById("finishMatchBtn")
	if(finishMatchBtn){
		finishMatchBtn.addEventListener("click", confirmFinishMatch)
	}
}

function init(){
	// 状態復元
	loadState()
	// バージョン情報表示
	// document.getElementById("appInfo").innerText = `${APP_NAME} ${APP_VERSION}`
	updateTopEnvLabel()

	/* 画面表示 */
	if(state.score.pointA > 1 || state.score.pointB > 1 || state.gameResults.length > 0){
		// 試合途中の場合は試合画面表示
		document.getElementById("match").classList.remove("hidden")
		document.getElementById("setup").classList.add("hidden")
		document.getElementById("appInfo").classList.add("hidden")
		createScoreboard()
		initPlayers()
		updateUI()
	}else{
		// 試合前の場合は設定画面表示
		document.getElementById("match").classList.add("hidden")
		document.getElementById("setup").classList.remove("hidden")
		document.getElementById("appInfo").classList.remove("hidden")
	}

	updateEnvLabel()

	// イベントハンドラ設定(ここではまだundoボタンのみ)
	setupEventHandlers()
	
	//updateUI()
}

init()