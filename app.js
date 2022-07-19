const mapData = {
	minX: 1,
	maxX: 14,
	minY: 4,
	maxY: 12,
	blockedSpaces: {
		"7x4": true,
		"1x11": true,
		"12x10": true,
		"4x7": true,
		"5x7": true,
		"6x7": true,
		"8x6": true,
		"9x6": true,
		"10x6": true,
		"7x9": true,
		"8x9": true,
		"9x9": true,
	},
};

// Options for Player Colors... these are in the same order as our sprite sheet
const playerColors = ["blue", "red", "orange", "yellow", "green", "purple"];

//Misc Helpers
function randomFromArray(array) {
	return array[Math.floor(Math.random() * array.length)];
}
function getKeyString(x, y) {
	return `${x}x${y}`;
}

function createName() {
	const prefix = randomFromArray([
		"COOL",
		"SUPER",
		"HIP",
		"SMUG",
		"COOL",
		"SILKY",
		"GOOD",
		"SAFE",
		"DEAR",
		"DAMP",
		"WARM",
		"RICH",
		"LONG",
		"DARK",
		"SOFT",
		"BUFF",
		"DOPE",
	]);
	const animal = randomFromArray([
		"BEAR",
		"DOG",
		"CAT",
		"FOX",
		"LAMB",
		"LION",
		"BOAR",
		"GOAT",
		"VOLE",
		"SEAL",
		"PUMA",
		"MULE",
		"BULL",
		"BIRD",
		"BUG",
	]);
	return `${prefix} ${animal}`;
}

function isSolid(x, y) {

	const blockedNextSpace = mapData.blockedSpaces[getKeyString(x, y)];
	return (
		blockedNextSpace ||
		x >= mapData.maxX ||
		x < mapData.minX ||
		y >= mapData.maxY ||
		y < mapData.minY
	)
}

function isOccupiedByPlayer(x, y, playersArray) {
	for (let p in playersArray) {
		if (x === playersArray[p].x && y === playersArray[p].y) {
			return true;
		}
	}

	return false;
}

function getRandomSafeSpot(playersArray) {
	let counter = 0;

	while (true) {
		let chosenPos = { 
			x: Math.floor( mapData.minX + Math.random() * (mapData.maxX - mapData.minX)),
			y: Math.floor( mapData.minY + Math.random() * (mapData.maxY - mapData.minY))
		}

		if (counter >= 100) {
			return chosenPos;
		}

		if(!isSolid(chosenPos.x, chosenPos.y) && !isOccupiedByPlayer(chosenPos.x, chosenPos.y, playersArray)) {
			return chosenPos;
		} else {
			counter += 1;
		}
	}

	//We don't look things up by key here, so just return an x/y
	return randomFromArray([
		{ x: 1, y: 4 },
		{ x: 2, y: 4 },
		{ x: 1, y: 5 },
		{ x: 2, y: 6 },
		{ x: 2, y: 8 },
		{ x: 2, y: 9 },
		{ x: 4, y: 8 },
		{ x: 5, y: 5 },
		{ x: 5, y: 8 },
		{ x: 5, y: 10 },
		{ x: 5, y: 11 },
		{ x: 11, y: 7 },
		{ x: 12, y: 7 },
		{ x: 13, y: 7 },
		{ x: 13, y: 6 },
		{ x: 13, y: 8 },
		{ x: 7, y: 6 },
		{ x: 7, y: 7 },
		{ x: 7, y: 8 },
		{ x: 8, y: 8 },
		{ x: 10, y: 8 },
		{ x: 8, y: 8 },
		{ x: 11, y: 4 },
	]);
}


(function () {

	let playerId;
	let playerRef;
	let players = {};
	let playerElements = {};
	let coins = {};
	let coinElements = {};
	let moveTimer = 0;

	const gameContainer = document.querySelector(".game-container");
	const playerNameInput = document.querySelector("#player-name");
	const playerColorButton = document.querySelector("#player-color");


	function placeCoin() {
		if(Object.keys(coins).length < 15) {
			const { x, y } = getRandomSafeSpot(players);
			const coinRef = firebase.database().ref(`coins/${getKeyString(x, y)}`);
			coinRef.set({
				x,
				y,
			})
		}
		
		const coinTimeouts = Math.random() * 2000;
		setTimeout(() => {
			placeCoin();
		}, coinTimeouts);
	}

	function attemptGrabCoin(x, y) {
		const key = getKeyString(x, y);
		if (coins[key]) {
			// Remove this key from data, then uptick Player's coin count
			firebase.database().ref(`coins/${key}`).remove();
			playerRef.update({
				coins: players[playerId].coins + 1,
			})
		}
	}


	function handleArrowPress(xChange = 0, yChange = 0) {
		const newX = players[playerId].x + xChange;
		const newY = players[playerId].y + yChange;
		if (!isSolid(newX, newY) && !isOccupiedByPlayer(newX, newY, players) && moveTimer <= 0) {
			//move to the next space
			players[playerId].x = newX;
			players[playerId].y = newY;
			if (xChange === 1) {
				players[playerId].direction = "right";
			}
			if (xChange === -1) {
				players[playerId].direction = "left";
			}
			playerRef.set(players[playerId]);
			attemptGrabCoin(newX, newY);
			moveTimer = 0.4; // Can move once every 0.5seconds
		}
	}

	function initGame() {
		
		// The UPDATE Function
		function step() {
			if (moveTimer > 0) { 
				moveTimer -= 1/60;
			}
	
			requestAnimationFrame(() => { // Web browser calls this function every time a new frame begins
				step();
			})
		}

		moveTimer = 0;
		step();

		new KeyPressListener("ArrowUp", () => handleArrowPress(0, -1))
		new KeyPressListener("ArrowDown", () => handleArrowPress(0, 1))
		new KeyPressListener("ArrowLeft", () => handleArrowPress(-1, 0))
		new KeyPressListener("ArrowRight", () => handleArrowPress(1, 0))

		const allPlayersRef = firebase.database().ref(`players`);
		const allCoinsRef = firebase.database().ref(`coins`);

		allPlayersRef.on("value", (snapshot) => {
			//Fires whenever a change occurs
			players = snapshot.val() || {};

			// ASSIGN MAIN PLAYER

			// If nobody is the mainplayer, assign it to him
			let nobodyIsMainPlayer = true;
			for (let p in players) {
				if(players[p].mainPlayer) {
					nobodyIsMainPlayer = false;
				}
			}

			if (nobodyIsMainPlayer) {
				let newMainPlayer = players[Object.keys(players)[0]];
				console.log("New Main Player: " + newMainPlayer.name + " (ID: " + newMainPlayer.id + ")");

				playerRef = firebase.database().ref(`players/${newMainPlayer.id}`);
				playerRef.update({
					mainPlayer : true,
				})
			}

			Object.keys(players).forEach((key) => { // For each player...
				const characterState = players[key];
				let el = playerElements[key];
				// Now update the DOM
				el.querySelector(".Character_name").innerText = characterState.name;
				el.querySelector(".Character_coins").innerText = characterState.coins;
				el.setAttribute("data-color", characterState.color);
				el.setAttribute("data-direction", characterState.direction);
				const left = 16 * characterState.x + "px";
				const top = 16 * characterState.y - 4 + "px";
				el.style.transform = `translate3d(${left}, ${top}, 0)`;

				if (characterState.mainPlayer) {
					el.setAttribute("main-player", true);
				} else {
					el.setAttribute("main-player", false);
				}

				let effectsContainer = "";

				if(characterState.mainPlayer) {
					effectsContainer = effectsContainer + `<span class="Character_name-main-player-container">&#128187;</span>`;
				}

				el.querySelector(".Character_effects-container").innerHTML = effectsContainer;
			})
		})

		allPlayersRef.on("child_added", (snapshot) => {
			//Fires whenever a new node is added the tree
			const addedPlayer = snapshot.val();
			console.log(addedPlayer);
			const characterElement = document.createElement("div");
			characterElement.classList.add("Character", "grid-cell");
			if (addedPlayer.id === playerId) {
				characterElement.setAttribute("you", true);
			} else {
				characterElement.setAttribute("you", false);
			}

			characterElement.innerHTML = (`
				<div class="Character_shadow grid-cell"></div>
				<div class="Character_sprite grid-cell"></div>
				<div class="Character_effects-container">
				</div>
				<div class="Character_name-container">
					<span class="Character_name"></span>
					<span class="Character_coins">0</span>
				</div>
			`);

			playerElements[addedPlayer.id] = characterElement;

			//Fill in some initial state
			characterElement.querySelector(".Character_name").innerText = addedPlayer.name;
			characterElement.querySelector(".Character_coins").innerText = addedPlayer.coins;
			characterElement.setAttribute("data-color", addedPlayer.color);
			characterElement.setAttribute("data-direction", addedPlayer.direction);
			const left = 16 * addedPlayer.x + "px";
			const top = 16 * addedPlayer.y - 4 + "px";
			characterElement.style.transform = `translate3d(${left}, ${top}, 0)`;
			gameContainer.appendChild(characterElement);
		})


		//Remove character DOM element after they leave
		allPlayersRef.on("child_removed", (snapshot) => {
			const removedKey = snapshot.val().id;
			gameContainer.removeChild(playerElements[removedKey]);
			delete playerElements[removedKey];
		})


		//New - not in the video!
		//This block will remove coins from local state when Firebase `coins` value updates
		allCoinsRef.on("value", (snapshot) => {
			coins = snapshot.val() || {};
		});
		//

		allCoinsRef.on("child_added", (snapshot) => {
			const coin = snapshot.val();
			const key = getKeyString(coin.x, coin.y);
			coins[key] = true;

			// Create the DOM Element
			const coinElement = document.createElement("div");
			coinElement.classList.add("Coin", "grid-cell");
			coinElement.innerHTML = `
          <div class="Coin_shadow grid-cell"></div>
          <div class="Coin_sprite grid-cell"></div>
        `;

			// Position the Element
			const left = 16 * coin.x + "px";
			const top = 16 * coin.y - 4 + "px";
			coinElement.style.transform = `translate3d(${left}, ${top}, 0)`;

			// Keep a reference for removal later and add to DOM
			coinElements[key] = coinElement;
			gameContainer.appendChild(coinElement);
		})

		allCoinsRef.on("child_removed", (snapshot) => {
			const { x, y } = snapshot.val();
			const keyToRemove = getKeyString(x, y);
			gameContainer.removeChild(coinElements[keyToRemove]);
			delete coinElements[keyToRemove];
		})


		//Updates player name with text input
		playerNameInput.addEventListener("change", (e) => {
			const newName = e.target.value || createName();
			playerNameInput.value = newName;
			playerRef.update({
				name: newName
			})
		})

		//Update player color on button click
		playerColorButton.addEventListener("click", () => {
			const mySkinIndex = playerColors.indexOf(players[playerId].color);
			const nextColor = playerColors[mySkinIndex + 1] || playerColors[0];
			playerRef.update({
				color: nextColor
			})
		})

		//Place my first coin
		placeCoin();

	}

	firebase.auth().onAuthStateChanged((user) => {
		console.log(user)
		if (user) {
			//You're logged in!
			playerId = user.uid;
			playerRef = firebase.database().ref(`players/${playerId}`);

			const name = createName();
			playerNameInput.value = name;

			const { x, y } = getRandomSafeSpot(players);


			playerRef.set({
				id: playerId,
				name,
				direction: "right",
				color: randomFromArray(playerColors),
				x,
				y,
				coins: 0,
				mainPlayer : false,
			})

			//Remove me from Firebase when I diconnect
			playerRef.onDisconnect().remove();

			//Begin the game now that we are signed in
			initGame();
		} else {
			//You're logged out.
		}
	})

	firebase.auth().signInAnonymously().catch((error) => {
		var errorCode = error.code;
		var errorMessage = error.message;
		// ...
		console.log(errorCode, errorMessage);
	});


})();
