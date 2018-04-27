var io = require('socket.io')(8085);
var fs = require("fs")

/*
Game modes:
0 = Free for all
1 = Team Deathmatch
*/
var teams = [{
    numPlayers:0,
    kills:0,
    defaultVars:{
      health:100,
      size:32,
      speed:9
    }
  },{
    numPlayers:0,
    kills:0,
    defaultVars:{
      health:100,
      size:32,
      speed:9
    }
  },{
    numPlayers:0,
    kills:0,
    defaultVars:{
      health:100,
      size:32,
      speed:9
    }
  },
]
var gameMode = 0;
var gameModes = [{
  respawnTime:4000,
  teams:[0]
},{
  respawnTime:6000,
  teams:[1,2]
}]
var playersSinceLastLog = 0;
//Weapons set up
var weaponsList = {
  rifle:{
    onHit:function(bullet,playerHit) {
      damagePlayer(20,bullet.source,"rifle",playerHit);
    },
    shoot:function(shooter,cursor) {
      var distance = Math.sqrt((cursor.x - canvas.width/2)*(cursor.x - canvas.width/2) + (cursor.y - canvas.height/2)*(cursor.y - canvas.height/2));
      var spdx = (cursor.x - canvas.width/2)/distance * weaponsList.rifle.speed;
      var spdy = (cursor.y - canvas.height/2)/distance * weaponsList.rifle.speed;
      createBullet(shooter,spdx,spdy);
    },
    shootInterval:400,
    speed:24,
    bulletSize:16,
    travelDistance:800,
    attackType:1
  },
  shotgun:{
    onHit:function(bullet,playerHit) {
      damagePlayer(9,bullet.source,"shotgun",playerHit);
    },
    shoot:function(shooter,cursor) {
      var circle = {
        x:canvas.width/2,
        y:canvas.height/2,
        radius:Math.sqrt((cursor.x - canvas.width/2)*(cursor.x - canvas.width/2) + (cursor.y - canvas.height/2)*(cursor.y - canvas.height/2))
      }
      var point = {
        x:cursor.x,
        y:cursor.y
      };
      //Get distance from point to circle;
      var distX = point.x-circle.x;
      var distY = point.y-circle.y;
      //Scale circle and the points.
      distX *= (2/circle.radius);
      distY *= (2/circle.radius);
      circle.radius *= (2/circle.radius);

      point.x = distX + circle.x;
      point.y = distY + circle.y;

      //We will use an angle of 0.08
      var curAngle = Math.atan2(point.y-circle.y,point.x-circle.x);
      for (var i = 1; i <= 10; i++) {
        var newX = circle.x + circle.radius*Math.cos(curAngle+0.08*(i-5));
        var newY = circle.y + circle.radius*Math.sin(curAngle+0.08*(i-5));

        var spdx = (newX - circle.x)/circle.radius * weaponsList.shotgun.speed;
        var spdy = (newY - circle.y)/circle.radius * weaponsList.shotgun.speed;
        createBullet(shooter,spdx,spdy)
      }
    },
    shootInterval:650,
    speed:30,
    bulletSize:12,
    travelDistance:275,
    attackType:1
  },
  sniper:{
    onHit:function(bullet,playerHit) {
      damagePlayer(90,bullet.source,"sniper",playerHit);
    },
    shoot:function(shooter,cursor) {
      var distance = Math.sqrt((cursor.x - canvas.width/2)*(cursor.x - canvas.width/2) + (cursor.y - canvas.height/2)*(cursor.y - canvas.height/2));
      var spdx = (cursor.x - canvas.width/2)/distance * weaponsList.sniper.speed;
      var spdy = (cursor.y - canvas.height/2)/distance * weaponsList.sniper.speed;
      createBullet(shooter,spdx,spdy);
    },
    shootInterval:1750,
    speed:27,
    bulletSize:8,
    travelDistance:2000,
    attackType:1
  },
  machineGun:{
    onHit:function(bullet,playerHit) {
      damagePlayer(8,bullet.source,"machineGun",playerHit);
    },
    shoot:function(shooter,cursor) {
      var distance = Math.sqrt((cursor.x - canvas.width/2)*(cursor.x - canvas.width/2) + (cursor.y - canvas.height/2)*(cursor.y - canvas.height/2));
      var spdx = (cursor.x - canvas.width/2)/distance * weaponsList.machineGun.speed;
      var spdy = (cursor.y - canvas.height/2)/distance * weaponsList.machineGun.speed;
      createBullet(shooter,spdx,spdy);
    },
    shootInterval:85,
    speed:27,
    bulletSize:8,
    travelDistance:550,
    attackType:1
  },
  rocketLauncher:{
    onHit:function(bullet,playerShoot) {
      createExplosion(bullet.x,bullet.y,125,25,200,playerShoot,"rocketLauncher",weaponsList.rocketLauncher.damage);
    },
    shoot:function(shooter,cursor) {
      var distance = Math.sqrt((cursor.x - canvas.width/2)*(cursor.x - canvas.width/2) + (cursor.y - canvas.height/2)*(cursor.y - canvas.height/2));
      var spdx = (cursor.x - canvas.width/2)/distance * weaponsList.rocketLauncher.speed;
      var spdy = (cursor.y - canvas.height/2)/distance * weaponsList.rocketLauncher.speed;
      createBullet(shooter,spdx,spdy);
    },
    shootInterval:2500,
    speed:22,
    bulletSize:24,
    travelDistance:700,
    damage:85,
    attackType:2
  },
  jihad:{
    shoot:function(shooter,cursor) {
      playerListSecure[shooter].isJihad = true;
      setTimeout(function() {
        if (playerListSecure[shooter]) {
          if (playerListSecure[shooter].alive) {
            createExplosion(playerListSecure[shooter].x+playerListSecure[shooter].width*0.5,playerListSecure[shooter].y+playerListSecure[shooter].height*0.5,300,75,200,shooter,"jihad",weaponsList.jihad.damage);
            playerListSecure[shooter].curWeapon = "rifle";
            io.sockets.connected[shooter].emit('new-weapon',"rifle");
            suicidePlayer(shooter);
          }
        }
      },weaponsList.jihad.shootInterval);
    },
    damage:130,
    shootInterval:2000
  }
}
var bonusesList = {
  speed:{
    activate:function(playerId) {
      playerListSecure[playerId].modifiers.speed = 1.5;
      playerListSecure[playerId].bonuses.speed.present = true;
      playerListSecure[playerId].bonuses.speed.expireAt = Date.now()+10000;
    },
    deactivate:function(playerId) {
      playerListSecure[playerId].modifiers.speed = 1;
      playerListSecure[playerId].bonuses.speed.present = false;
      playerListSecure[playerId].bonuses.speed.expireAt = 0;
    }
  },
  damage:{
    activate:function(playerId) {
      playerListSecure[playerId].modifiers.damage = 1.2;
      playerListSecure[playerId].bonuses.damage.present = true;
      playerListSecure[playerId].bonuses.damage.expireAt = Date.now()+10000;
    },
    deactivate:function(playerId) {
      playerListSecure[playerId].modifiers.damage = 1;
      playerListSecure[playerId].bonuses.damage.present = false;
      playerListSecure[playerId].bonuses.damage.expireAt = 0;
    }
  },
  health:{
    activate:function(playerId) {
      playerListSecure[playerId].health=teams[playerListOpen[playerId].team].defaultVars.health;
    }
  }
}

var canvas = {
  width:800,
  height:600
}
var currentMap;
var maps = {};
var mapNames = [];
var mapsReady = false;
var blockSize = 64;
var pColBlocks = [];
var bColBlocks = [];
var extraColBlocks = {};
var bullets = [];
var explosions = [];
var bonuses = [];
var spawnPoints = [[],[],[],[],[],[],[],[]];

function getTileProperties(tile) {
  var properties = {
    collidePlayer:false,
    collideBullet:false
  }
  var collidePlayerTiles = [2,11];
  var collideBulletTiles = [2];
  for (var i = 0; i < collidePlayerTiles.length; i++) {
    if (tile == collidePlayerTiles[i]) {
      properties.collidePlayer = true;
      break;
    }
  }
  for (var j = 0; j < collideBulletTiles.length; j++) {
    if (tile == collideBulletTiles[j]) {
      properties.collideBullet = true;
      break;
    }
  }
  return properties;
}
function getExtraProperties(extra) {
  var properties = {
    isSpawnPoint:false,
    isBonusPoint:false,
    isActive:false,
    collide:false
  };
  if (extra <= -1 && extra >= -8) {
    properties.isSpawnPoint = true;
  }
  else if (extra == -9) {
    properties.isBonusPoint = true;
  }
  else if (extra >= 10 && extra <= 17) {
    properties.isActive = true;
    properties.collide = true;
  }
  else if (extra >= 20 && extra <= 25) {
    properties.collide = true;
  }
  return properties;
}

function loadmaps() {
  fs.readFile(__dirname + "/maps.txt", 'utf-8', function(err,data) {
    if (err) {
      console.log(err)
    }else{
      var lines = data.split("\n");
      var curMap = {
        map:[],
        colMap:[],
        extrMap:{},
        extrColMap:[],
        activeExtras:[],
        spawnPoints:[[],[],[],[],[],[],[],[]],
        bonusPoints:[]
      };
      for (var i = 0; i < lines.length; i++) {
        if (lines[i] === "x") {
          //Done current map
          maps[curMap.name] = curMap;
          mapNames.push(curMap.name);
          curMap = {
            map:[],
            colMap:[],
            extrMap:{},
            extrColMap:[],
            activeExtras:[],
            spawnPoints:[[],[],[],[],[],[],[],[]],
            bonusPoints:[]
          };
        }
        else if (lines[i].split(":").length>0){
          var split = lines[i].split(":");
          if (split[0] === "name") {
            curMap.name = split[1];
          }
          else if (split[0] === "bgcolor") {
            curMap.bgcolor = split[1];
          }
          else if (split[0] === "map") {
            var mapToParse = split[1].split("|");
            var extraId = 0;
            for (var j = 0; j < mapToParse.length;j++) {
              var curMapLine = [];
              var curColMapLine = [];
              var indivs = mapToParse[j].split(',');
              for (var k = 0; k < indivs.length; k++) {
                var indiv = indivs[k].split('/');
                var tileProps = getTileProperties(indiv[0]);
                if (Number(indiv[1]) != 0) {
                  curMap.extrMap[extraId] = {
                    extra:Number(indiv[1]),
                    x:curMapLine.length,
                    y:curMap.map.length
                  }
                  var extraProps = getExtraProperties(indiv[1]);
                  if (extraProps.isSpawnPoint) {
                    curMap.spawnPoints[Math.abs(Number(indiv[1])+1)].push(extraId);
                  }
                  else if (extraProps.isBonusPoint) {
                    curMap.bonusPoints.push({
                      id:extraId
                    });
                  }

                  if (extraProps.isActive) {
                    curMap.activeExtras.push(extraId);
                  }
                  if (extraProps.collide) {
                    curMap.extrColMap[extraId] = {
                      extra:Number(indiv[1]),
                      x:curMapLine.length,
                      y:curMap.map.length
                    }
                  }
                  extraId++;
                }
                curColMapLine.push([tileProps.collidePlayer,tileProps.collideBullet]);
                curMapLine.push(Number(indiv[0]));
              }
              curMap.map.push(curMapLine);
              curMap.colMap.push(curColMapLine);
            }
            curMap.width = curMap.map[0].length*blockSize;
            curMap.height = curMap.map.length*blockSize;
          }
        }else{
          //Empty line means we done
        }
      }
      mapsReady = true;
      console.log("Maps loaded")
      loadRandomMap();
    }
  })
}
loadmaps();

function getCollisionOfExtra(extra,oldx,oldy) {
  var x = oldx;
  var y = oldy;
  var width = blockSize;
  var height = blockSize;
  var collisions = [];

  if (extra >= 20 && extra <= 25) {
    collisions.push({
      x:x+26,
      y:y+26,
      width:12,
      height:12
    });
  }
  if (extra == 10 || extra == 11) {
    collisions.push({
      x:x,
      y:y+64-11,
      width:width,
      height:8
    });
  }
  else if (extra == 12 || extra == 13) {
    collisions.push({
      x:x,
      y:y+3,
      width:width,
      height:8
    });
  }
  else if (extra == 14 || extra == 16) {
    collisions.push({
      x:x+3,
      y:y,
      width:8,
      height:height
    });
  }
  else if (extra == 15 || extra == 17) {
    collisions.push({
      x:x+64-11,
      y:y,
      width:8,
      height:height
    });
  }
  else if (extra == 20) {
    collisions.push({
      x:x+30,
      y:y,
      width:4,
      height:height
    });
  }
  else if (extra == 21) {
    collisions.push({
      x:x,
      y:y+30,
      width:width,
      height:4
    });
  }
  else if (extra == 22) {
    collisions.push({
      x:x+36,
      y:y+30,
      width:28,
      height:4
    });
    collisions.push({
      x:x+30,
      y:y+36,
      width:4,
      height:28
    });
  }
  else if (extra == 23) {
    collisions.push({
      x:x,
      y:y+30,
      width:26,
      height:4
    });
    collisions.push({
      x:x+30,
      y:y+36,
      width:4,
      height:28
    });
  }
  else if (extra == 24) {
    collisions.push({
      x:x+36,
      y:y+30,
      width:28,
      height:4
    });
    collisions.push({
      x:x+30,
      y:y,
      width:4,
      height:26
    });
  }
  else if (extra == 25) {
    collisions.push({
      x:x,
      y:y+30,
      width:26,
      height:4
    });
    collisions.push({
      x:x+30,
      y:y,
      width:4,
      height:26
    });
  }

  return collisions;
}

function loadMap(map) {
  var curMap = maps[map];
  //Setup blocks
  for (var i = 0; i < curMap.colMap.length; i++) {
    for (var j = 0; j < curMap.colMap[i].length; j++) {
      if (curMap.colMap[i][j][0]) {
        pColBlocks.push({
          x:j*blockSize,
          y:i*blockSize,
          width:blockSize,
          height:blockSize
        });
      }
      if (curMap.colMap[i][j][1]) {
        bColBlocks.push({
          x:j*blockSize,
          y:i*blockSize,
          width:blockSize,
          height:blockSize
        });
      }
    }
  }
  for (var e in curMap.extrColMap) {
    var x = curMap.extrColMap[e].x * blockSize;
    var y = curMap.extrColMap[e].y * blockSize;
    extraColBlocks[e] = getCollisionOfExtra(curMap.extrColMap[e].extra,x,y);
  }
  spawnPoints = maps[map].spawnPoints;
  //Push map bounds
  pColBlocks.push({x:0,y:0,width:curMap.width,height:2},{x:0,y:0,width:2,height:curMap.height},{x:curMap.width,y:0,width:2,height:curMap.height},{x:0,y:curMap.height,width:curMap.width,height:curMap.height});
  bColBlocks.push({x:0,y:0,width:curMap.width,height:2},{x:0,y:0,width:2,height:curMap.height},{x:curMap.width,y:0,width:2,height:curMap.height},{x:0,y:curMap.height,width:curMap.width,height:curMap.height});
  currentMap = map;
  io.emit('send-map',maps[map].name,maps[map].map,maps[map].extrMap,maps[currentMap].bgcolor,gameMode);
}
function loadRandomMap() {
  loadMap(mapNames[Math.floor(Math.random()*mapNames.length)])
}

var clients = [];
var playerListSecure = {}; //Player list secure contains information such as x position, y position, Information that is only sent to users in close proximity to avoid cheating.
var playerListOpen = {}; //Player list open contains information such as username, color, team, etc. Information that is available to all users, all the time.

function sendOpenPlayerList() {
  io.emit('send-basic-player-info', playerListOpen);
}
function sendPlayerlistSecure() {
  for (var c = 0; c < clients.length; c++) {
    var newListToSend = {};
    var curPlayer = playerListSecure[clients[c]];
    if (typeof curPlayer !== "undefined") {
      var centerOfCurPlayer = {
        x:curPlayer.x+curPlayer.width/2,
        y:curPlayer.y+curPlayer.height/2
      }
      for (var p in playerListSecure) {
        if (p === clients[c]) {
          //Always send yo' self
          newListToSend[clients[c]] = {
            x:curPlayer.x,
            y:curPlayer.y,
            width:curPlayer.width,
            height:curPlayer.height,
            health:curPlayer.health,
            isJihad:curPlayer.isJihad,
            isInvuln:curPlayer.isInvuln,
            bonuses:curPlayer.bonuses,
            weapon:curPlayer.curWeapon,
            mouse:curPlayer.inputs.mousePos,
            canAttack:curPlayer.canAttack,
            alive:curPlayer.alive
          }
        }
        else if (playerListSecure[p].alive) {
          var centerOfCheckPlayer = {
            x:playerListSecure[p].x+playerListSecure[p].width/2,
            y:playerListSecure[p].y+playerListSecure[p].height/2
          }
          //To send the player, the player needs to be within 400 units left/right, and 300 units up/down
          var extra = 50;
          if (Math.abs(centerOfCurPlayer.x-centerOfCheckPlayer.x) <= canvas.width + (0.5 * playerListSecure[p].width+extra)) {
            //User is in x proximity, check for y now
            if (Math.abs(centerOfCurPlayer.y-centerOfCheckPlayer.y) <= canvas.height + (0.5 * playerListSecure[p].height+extra)) {
              //User is in proximity, send
              newListToSend[p] = {
                x:playerListSecure[p].x,
                y:playerListSecure[p].y,
                width:playerListSecure[p].width,
                height:playerListSecure[p].height,
                health:playerListSecure[p].health,
                isJihad:playerListSecure[p].isJihad,
                isInvuln:playerListSecure[p].isInvuln,
                bonuses:playerListSecure[p].bonuses,
                weapon:playerListSecure[p].curWeapon,
                mouse:playerListSecure[p].inputs.mousePos
              }
            }
          }
        }
      }
      io.sockets.connected[clients[c]].emit('send-secure-player-info', newListToSend);
    }
  }
}
function sendBulletList() {
  for (var c = 0; c < clients.length; c++) {
    var newListToSend = [];
    var curPlayer = playerListSecure[clients[c]];
    var centerOfCurPlayer = {
      x:curPlayer.x+curPlayer.width/2,
      y:curPlayer.y+curPlayer.height/2
    }
    for (var b = 0; b < bullets.length; b++) {
      var centerOfBullet = {
        x:bullets[b].x+weaponsList[bullets[b].weapon].bulletSize,
        y:bullets[b].y+weaponsList[bullets[b].weapon].bulletSize
      }
      //Only send the bullet if the bullet will be on the user's screen
      if (Math.abs(centerOfCurPlayer.x-centerOfBullet.x) <= canvas.width + (0.5 * weaponsList[bullets[b].weapon].bulletSize)) {
        //User is in x proximity, check for y now
        if (Math.abs(centerOfCurPlayer.y-centerOfBullet.y) <= canvas.height + (0.5 * weaponsList[bullets[b].weapon].bulletSize)) {
          newListToSend.push(bullets[b]);
        }
      }
    }
    io.sockets.connected[clients[c]].emit('send-bullet-info', newListToSend);
  }
}
function sendExplosionsList() {
  for (var c = 0; c < clients.length; c++) {
    var newListToSend = [];
    var curPlayer = playerListSecure[clients[c]];
    var centerOfCurPlayer = {
      x:curPlayer.x+curPlayer.width/2,
      y:curPlayer.y+curPlayer.height/2
    };
    for (var e = 0; e < explosions.length; e++) {
      if (Math.abs(centerOfCurPlayer.x-explosions[e].x) <= canvas.width + (0.5 * curPlayer.width)) {
        if (Math.abs(centerOfCurPlayer.y-explosions[e].y) <= canvas.height + (0.5 * curPlayer.height)) {
          newListToSend.push({
            x:explosions[e].x,
            y:explosions[e].y,
            radius:explosions[e].curRadius
          });
        }
      }
    }

    io.sockets.connected[clients[c]].emit('send-explosions-info', newListToSend);
  }
}
function sendBonusesList() {
  for (var c = 0; c < clients.length; c++) {
    var newListToSend = [];
    var curPlayer = playerListSecure[clients[c]];
    var centerOfCurPlayer = {
      x:curPlayer.x+curPlayer.width/2,
      y:curPlayer.y+curPlayer.height/2
    };
    for (var b = 0; b < bonuses.length; b++) {
      var centerOfBonus = {
        x:bonuses[b].x+bonuses[b].width*0.5,
        y:bonuses[b].y+bonuses[b].height*0.5
      }
      if (Math.abs(centerOfCurPlayer.x-centerOfBonus.x) <= canvas.width + (0.5 * curPlayer.width)) {
        if (Math.abs(centerOfCurPlayer.y-centerOfBonus.y) <= canvas.height + (0.5 * curPlayer.height)) {
          newListToSend.push({
            bonus:bonuses[b].bonus,
            x:bonuses[b].x,
            y:bonuses[b].y,
            width:bonuses[b].width,
            height:bonuses[b].height
          });
        }
      }
    }
    io.sockets.connected[clients[c]].emit('send-bonuses-info', newListToSend);
  }
}
function createNewPlayer(playerId,name) {
  //Get color/team of player.
  var color;
  var team;
  var colors = ["red","orange","purple","#e0d21a","#f586ff","green"];
  if (gameMode == 0) {
    //Free for all, give player random color among a set.
    color = colors[Math.floor(Math.random()*colors.length)];
    team = 0; //In free for all, always set team to 0.
  }
  else if (gameMode == 1) {
    var team;
    if (teams[gameModes[1].teams[0]].numPlayers == teams[gameModes[1].teams[1]].numPlayers) {
      team = gameModes[1].teams[Math.floor(Math.random()*gameModes[1].teams.length)];
    }
    else if (teams[gameModes[1].teams[0]].numPlayers > teams[gameModes[1].teams[1]].numPlayers) {
      team = gameModes[1].teams[1];
    }else{
      team = gameModes[1].teams[0];
    }
    color = colors[team];
  }

  playerListOpen[playerId] = {
    name:name.substr(0,18),
    id:playerId,
    color:color,
    team:team,
    score:0,
    kills:0,
    deaths:0
  }
  playerListSecure[playerId] = {
    x:0,
    y:0,
    inputs:{
      moveUp:false,
      moveDown:false,
      moveLeft:false,
      moveRight:false,
      mouseDown:false,
      mousePos:{x:0,y:0}
    },
    alive:false,
    health:teams[team].defaultVars.health,
    width:teams[team].defaultVars.size,
    height:teams[team].defaultVars.size,
    speed:teams[team].defaultVars.speed,
    curWeapon:"rifle",
    canAttack:true,
    lastAttack:{
      time:null,
      weapon:null
    },
    isInvlun:false,
    isJihad:false,
    modifiers:{
      speed:1,
      damage:1
    },
    bonuses:{
      speed:{
        present:false,
        expireAt:0
      },
      damage:{
        present:false,
        expireAt:0
      }
    }
  }
  io.emit('new-player',playerListOpen[playerId]);
  teams[team].numPlayers++;
  playerRespawn(playerId);
}
function deletePlayer(playerId) {
  delete playerListOpen[playerId];
  delete playerListSecure[playerId];
  io.emit('delete-player',playerId);
  //Delete from clients
  var newClients = [];
  for (var c = 0; c < clients.length; c++) {
    if (clients[c] !== playerId) {
      newClients.push(clients[c]);
    }
  }
  clients = newClients;
}

function getNewSpawnPosition(playerId) {
  var ready = false;
  var team = playerListOpen[playerId].team;
  var curSpawnpointArea = spawnPoints[team];
  while (!ready) {
    var curPoint = curSpawnpointArea[Math.floor(Math.random()*curSpawnpointArea.length)];
    var boundingBox = {
      x:maps[currentMap].extrMap[curPoint].x*blockSize,
      y:maps[currentMap].extrMap[curPoint].y*blockSize,
      width:playerListSecure[playerId].width,
      height:playerListSecure[playerId].height
    }
    boundingBox.x += (blockSize/2)-(playerListSecure[playerId].width/2);
    boundingBox.y += (blockSize/2)-(playerListSecure[playerId].height/2);
    var ready = true;
    for (var p in playerListSecure) {
      if (testCollision(boundingBox,playerListSecure[p])) {
        ready = false;
        break;
      }
    }
    if (ready) {
      return {
        x:boundingBox.x,
        y:boundingBox.y
      }
    }
  }
}
function getNewBonusPosition() {
  if (gameMode == 0 || gameMode == 1) {
    var ready = false;
    while (!ready) {
      var posx = Math.floor(Math.random()*maps[currentMap].width);
      var posy = Math.floor(Math.random()*maps[currentMap].height);
      ready = true;
      for (var b = 0; b < pColBlocks.length; b++) {
        if (testCollision(pColBlocks[b],{x:posx,y:posy,width:24,height:24})) {
          ready = false;
        }
      }
      for (var p in playerListSecure) {
        if (playerListSecure[p].alive) {
          if (testCollision({x:playerListSecure[p].x,y:playerListSecure[p].y,width:playerListSecure[p].width,height:playerListSecure[p].height},{x:posx,y:posy,width:teams[playerListOpen[p].team].defaultVars.size,height:teams[playerListOpen[p].team].defaultVars.size})) {
            ready = false;
          }
        }
      }
    }
    return {x:posx,y:posy};
  }
}

function createBonus() {
  //Get number of players
  for (var i = 0; i < Math.floor((clients.length)/2); i++) {
    var loc = getNewBonusPosition();
    //Get size of bonuses
    var bc = "";
    var size = 0;
    for (var b in bonusesList) {
      if (bonusesList.hasOwnProperty(b)) {

        size++;
      }
    }
    var random = Math.floor(Math.random()*size);
    var counter = 0;
    for (var b in bonusesList) {
      if (counter==random) {
        bc = b;
      }
      counter++;
    }

    bonuses.push({
      bonus:bc,
      x:loc.x,
      y:loc.y,
      width:24,
      height:24,
      active:true
    });
  }
  sendBonusesList();
}
function createExplosion(x,y,radius,startradius,time,source,weapon,damage) {
  explosions.push({
    x:x,
    y:y,
    startRadius:startradius,
    fullRadius:radius,
    curRadius:startradius,
    startTime:Date.now(),
    finishTime:Date.now()+time,
    source:source,
    weapon:weapon,
    active:true,
    damage:damage,
    playersHit:[]
  });
}

function createBullet(playerId,spdx,spdy) {
  var info = {
    x:playerListSecure[playerId].x,
    y:playerListSecure[playerId].y,
    width:playerListSecure[playerId].width,
    height:playerListSecure[playerId].height,
    weapon:playerListSecure[playerId].curWeapon,
  };
  bullets.push({
    x:info.x+info.width/2-weaponsList[info.weapon].bulletSize/2,
    y:info.y+info.height/2-weaponsList[info.weapon].bulletSize/2,
    spdx:spdx,
    spdy:spdy,
    distanceTravelled:0,
    source:playerId,
    weapon:info.weapon,
    active:true
  });
}

function suicidePlayer(player) {
  playerDie(player,player,"jihad");
}
function attackWithWeapon(playerId) {
  var cursor = {
    x:playerListSecure[playerId].inputs.mousePos.x,
    y:playerListSecure[playerId].inputs.mousePos.y
  };
  cursor.x -= weaponsList[playerListSecure[playerId].curWeapon].bulletSize/2;
  cursor.y -= weaponsList[playerListSecure[playerId].curWeapon].bulletSize/2;

  weaponsList[playerListSecure[playerId].curWeapon].shoot(playerId,cursor);
}

function testCollision(a,b) {
  //Only check if a & b are relatively close
  var ca = {
    x:a.x+a.width/2,
    y:a.y+a.height/2
  }
  var cb = {
    x:b.x+b.width/2,
    y:b.y+b.height/2
  }
  if (Math.abs(ca.x-cb.x) < (a.width+b.width)*3 && Math.abs(ca.y-cb.y) < (a.height+b.height)*3) {
    return b.x <= a.x + a.width && b.x + b.width >= a.x && b.y+b.height >= a.y && b.y <= a.y+a.height;
  }
  return false;
}
function testBulletCollision(bullet,a) {
  //Move the bullet 8 times individually, 99% of the time will catch if the bullet would otherwise have passed through the point.
  var testBullet = {
    x:bullet.x,
    y:bullet.y,
    width:bullet.width,
    height:bullet.height,
  }
  for (var x = 0; x<=8;x++) {
    testBullet.x-=bullet.spdx/8;
    testBullet.y-=bullet.spdy/8;
    if (testCollision(testBullet,a)) {
      return true;
    }
  }
  return false;
}

function playerCanDamagePlayer(p1,p2) {
  if (playerListSecure[p1] && playerListSecure[p2]) {
    if (p1==p2) {
      return false;
    }
    else if (playerListSecure[p2].alive == false) {
      return false;
    }else{
      if (gameMode == 0) {
        return true;
      }
      if (gameMode == 1) {
        return playerListOpen[p1].team != playerListOpen[p2].team;
      }
    }
  }else{
    return false;
  }
}

function distanceFromBlock(p1,block) {
  var leastDistance = {
    x:Math.abs(block.x-(p1.x+p1.width)),
    y:Math.abs(block.y-(p1.y+p1.height))
  };
  if (Math.abs((block.x+block.width)-p1.x) < leastDistance.x) {
    leastDistance.x = Math.abs((block.x+block.width)-p1.x);
  }
  if (Math.abs((block.y+block.height)-p1.y) < leastDistance.y) {
    leastDistance.y = Math.abs((block.y+block.height)-p1.y)
  }
  return leastDistance;
}

function use(player) {
  var centerOfPlayer = {
    x:player.x+player.width/2,
    y:player.y+player.height/2
  }
  for (var e = 0; e < maps[currentMap].activeExtras.length; e++) {
    var centerOfExtra = {
      x:maps[currentMap].extrMap[maps[currentMap].activeExtras[e]].x*blockSize+blockSize*0.5,
      y:maps[currentMap].extrMap[maps[currentMap].activeExtras[e]].y*blockSize+blockSize*0.5,
    }
    if (Math.abs(centerOfExtra.x-centerOfPlayer.x) <= 60 + player.width) {
      if (Math.abs(centerOfExtra.y-centerOfPlayer.y) <= 60 + player.height) {
        if (maps[currentMap].extrMap[maps[currentMap].activeExtras[e]].extra >= 10 && maps[currentMap].extrMap[maps[currentMap].activeExtras[e]].extra <= 17) {
          var newExtra = 0;
          if (maps[currentMap].extrMap[maps[currentMap].activeExtras[e]].extra <= 13) {
            var newExtra = maps[currentMap].extrMap[maps[currentMap].activeExtras[e]].extra+4;
          }else{
            var newExtra = maps[currentMap].extrMap[maps[currentMap].activeExtras[e]].extra-4;
          }
          //Make sure door wont collide with a player.
          var cont = true;
          var colArea = getCollisionOfExtra(newExtra, maps[currentMap].extrMap[maps[currentMap].activeExtras[e]].x*blockSize, maps[currentMap].extrMap[maps[currentMap].activeExtras[e]].y*blockSize)[0];
          for (var p in playerListSecure) {
            if (testCollision(playerListSecure[p],colArea)) {
                cont = false;
            }
          }
          if (cont) {
            maps[currentMap].extrMap[maps[currentMap].activeExtras[e]].extra=newExtra;
            extraColBlocks[maps[currentMap].activeExtras[e]][0] = colArea;
            io.emit('edit-extra',maps[currentMap].activeExtras[e],maps[currentMap].extrMap[maps[currentMap].activeExtras[e]].extra);
          }
        }
      }
    }
  }
}

function movePlayerClose(player1,player2) {
  if (player1.x > player2.x+player2.width) {
    player1.x  = (player2.x) + player2.width + 0.25;
  }
  else if (player1.x+player1.width < player2.x){
    player1.x  = (player2.x) - player1.width - 0.25;
  }
  if (player1.y > player2.y+player2.height) {
    player1.y  = (player2.y) + player2.height + 0.25;
  }
  else if (player1.y+player1.height < player2.y){
    player1.y  = (player2.y) - player1.height - 0.25;
  }
  return {

    x:player1.x,
    y:player1.y
  }
}
function testCollisionPlayers(newPlayer,oldPlayer,p) {
  var newPos = {
    x:newPlayer.x,
    y:newPlayer.y
  }
  for (var p2 in playerListSecure) {
    if (p!==p2) {
      if (playerListSecure[p2].alive) {
        if (testCollision(newPlayer,playerListSecure[p2])) {
          //Create bounding box around playerListSecure[p2]
          var bb = {
            x:playerListSecure[p2].x,
            y:playerListSecure[p2].y,
            width:playerListSecure[p2].width,
            height:playerListSecure[p2].height
          }
          newPos = movePlayerClose(oldPlayer,bb);
          newPlayer.x = newPos.x;
          newPlayer.y = newPos.y;
        }
      }
    }
  }
  return newPos;
}
function testCollisionBlocks(newPlayer,oldPlayer) {
  var newPos = {
    x:newPlayer.x,
    y:newPlayer.y
  }
  var bestDistance = {
    x:oldPlayer.width*2,
    y:oldPlayer.height*2
  };

  for (var b = 0; b < pColBlocks.length; b++) {
    if (testCollision(newPlayer,pColBlocks[b])) {
      var newDistance = distanceFromBlock(oldPlayer,pColBlocks[b]);
      if (newDistance.x < bestDistance.x) {
        bestDistance.x = newDistance.x
        newPos.x = movePlayerClose(oldPlayer,pColBlocks[b]).x;
      }
      if (newDistance.y < bestDistance.y) {
        bestDistance.y = newDistance.y
        newPos.y = movePlayerClose(oldPlayer,pColBlocks[b]).y;
      }
    }
  }

  for (var e in extraColBlocks) {
    for (var ec in extraColBlocks[e]) {
      if (testCollision(newPlayer,extraColBlocks[e][ec])) {
        var newDistance = distanceFromBlock(oldPlayer,extraColBlocks[e][ec]);
        if (newDistance.x < bestDistance.x) {
          bestDistance.x = newDistance.x
          newPos.x = movePlayerClose(oldPlayer,extraColBlocks[e][ec]).x;
        }
        if (newDistance.y < bestDistance.y) {
          bestDistance.y = newDistance.y
          newPos.y = movePlayerClose(oldPlayer,extraColBlocks[e][ec]).y;
        }
      }
    }
  }

  return newPos;
}

function checkExplosionCollision(explosion,player) {
  var explInfo = {
    hit:false,
    damage:0
  }
  var centerOfPlayer = {
    x:player.x+player.width/2,
    y:player.y+player.height/2
  }
  var distance = Math.sqrt((explosion.x-centerOfPlayer.x)*(explosion.x-centerOfPlayer.x)+(explosion.y-centerOfPlayer.y)*(explosion.y-centerOfPlayer.y));
  distance -= player.height/2;
  if (distance <= explosion.curRadius) {
    explInfo.hit = true;
    if (distance <= 25) {
      distance = 25;
    }
    explInfo.damage = Math.round( explosion.damage * (explosion.fullRadius-distance)/explosion.fullRadius);
  }
  return explInfo;
}

function playerRespawn(playerId) {
  if (gameMode == 0 || gameMode == 1) {
    var spawnPosition = getNewSpawnPosition(playerId);
    playerListSecure[playerId].x = spawnPosition.x;
    playerListSecure[playerId].y = spawnPosition.y;
    playerListSecure[playerId].health = teams[playerListOpen[playerId].team].defaultVars.health;
    playerListSecure[playerId].alive = true;
    playerListSecure[playerId].width = teams[playerListOpen[playerId].team].defaultVars.size;
    playerListSecure[playerId].height = teams[playerListOpen[playerId].team].defaultVars.size;
    playerListSecure[playerId].speed = teams[playerListOpen[playerId].team].defaultVars.speed;
    playerListSecure[playerId].isJihad = false;
    playerListSecure[playerId].isInvuln = true;
    playerListSecure[playerId].canAttack = true;
    setTimeout(function(){
      if (playerListSecure[playerId]) {
        playerListSecure[playerId].isInvuln = false;
      }
    },2500);
  }
}

function updatePlayerScore(playerId) {
  if (gameMode == 0) {
    playerListOpen[playerId].score = playerListOpen[playerId].kills
  }
}

function playerDie(killer,killed,weapon) {
  playerListSecure[killed].alive=false;
  playerListOpen[killed].deaths++;
  if (killer != killed) {
    playerListOpen[killer].kills++;
  }
  updatePlayerScore(killer);
  updatePlayerScore(killed);
  io.emit('player-killed',killer,killed,weapon);
  io.sockets.connected[killed].emit('death',gameModes[gameMode].respawnTime);
  setTimeout(function() {
    if (playerListSecure[killed]) {
      playerListSecure[killed].health=teams[playerListOpen[killed].team].defaultVars.health;
      playerRespawn(killed);
    }
  },gameModes[gameMode].respawnTime);
}

function damagePlayer(damage,source,weapon,playerHit) {
  if (!playerListSecure[playerHit].isInvuln) {
    playerListSecure[playerHit].health -= damage * playerListSecure[source].modifiers.damage;
    if (playerListSecure[playerHit].health <= 0) {
      playerDie(source,playerHit,weapon);
    }
  }
}

function update() {
  var sendBullets = bullets.length>0?true:false;
  var sendBonuses = bonuses.length>0?true:false;
  var sendExplosions = explosions.length>0?true:false;

  for (var bt = 0; bt < bullets.length; bt++) {
    //Bullet movements
    bullets[bt].x+=bullets[bt].spdx;
    bullets[bt].y+=bullets[bt].spdy;
    bullets[bt].distanceTravelled += Math.abs(bullets[bt].spdx)+Math.abs(bullets[bt].spdy);

    for (var b = 0; b < bColBlocks.length; b++) {
      if (bullets[bt].active) {
        if (testBulletCollision({
          x:bullets[bt].x,
          y:bullets[bt].y,
          width:weaponsList[bullets[bt].weapon].bulletSize,
          height:weaponsList[bullets[bt].weapon].bulletSize,
          spdx:bullets[bt].spdx,
          spdy:bullets[bt].spdy
        },bColBlocks[b])) {
          if (weaponsList[bullets[bt].weapon].attackType == 2) {
              weaponsList[bullets[bt].weapon].onHit(bullets[bt],bullets[bt].source);
          }
          bullets[bt].active = false;
        }
      }
    }
    for (var e in extraColBlocks) {
      for (var ec in extraColBlocks[e]) {
        if (bullets[bt].active) {
          if (testBulletCollision({
            x:bullets[bt].x,
            y:bullets[bt].y,
            width:weaponsList[bullets[bt].weapon].bulletSize,
            height:weaponsList[bullets[bt].weapon].bulletSize,
            spdx:bullets[bt].spdx,
            spdy:bullets[bt].spdy
          },extraColBlocks[e][ec])) {
            if (weaponsList[bullets[bt].weapon].attackType == 2) {
                weaponsList[bullets[bt].weapon].onHit(bullets[bt],bullets[bt].source);
            }
            bullets[bt].active = false;
          }
        }
      }
    }
    for (var pl in playerListSecure) {
      if (playerCanDamagePlayer(bullets[bt].source,pl)) {
        if (bullets[bt].active) {
          if (testBulletCollision({
            x:bullets[bt].x,
            y:bullets[bt].y,
            width:weaponsList[bullets[bt].weapon].bulletSize,
            height:weaponsList[bullets[bt].weapon].bulletSize,
            spdx:bullets[bt].spdx,
            spdy:bullets[bt].spdy
          },{
            x:playerListSecure[pl].x,
            y:playerListSecure[pl].y,
            width:playerListSecure[pl].width,
            height:playerListSecure[pl].height
          })) {
            if (weaponsList[bullets[bt].weapon].attackType == 1) {
              weaponsList[bullets[bt].weapon].onHit(bullets[bt],pl);
            }
            else if (weaponsList[bullets[bt].weapon].attackType == 2) {
              weaponsList[bullets[bt].weapon].onHit(bullets[bt],bullets[bt].source);
            }
            bullets[bt].active = false;
          }
        }
      }
    }
    if (bullets[bt].distanceTravelled >= weaponsList[bullets[bt].weapon].travelDistance) {
      bullets[bt].active = false;
    }

  }

  for (var p in playerListSecure) {
    var curPlayer = playerListSecure[p];
    var oldPlayer = {
      x:curPlayer.x,
      y:curPlayer.y,
      width:curPlayer.width,
      height:curPlayer.height
    }
    //Handle the bonuses
    for (var b in curPlayer.bonuses) {
      if (curPlayer.bonuses[b].present) {
        if (Date.now() >= curPlayer.bonuses[b].expireAt) {
          bonusesList[b].deactivate(p);
        }
      }
    }

    //Only move player if he is alive
    if (curPlayer.alive) {
      var speed = curPlayer.speed * curPlayer.modifiers.speed;
      if ((curPlayer.inputs.moveRight || curPlayer.inputs.moveLeft) && (curPlayer.inputs.moveUp || curPlayer.inputs.moveDown)) {
        speed = speed/Math.sqrt(2);
      }
      //Collision test on x movement
      curPlayer.x+=speed*curPlayer.inputs.moveRight;
      curPlayer.x-=speed*curPlayer.inputs.moveLeft;

      var checkPlayers1 = testCollisionPlayers(curPlayer,oldPlayer,p);
      curPlayer.x=checkPlayers1.x;
      var checkBlocks1 = testCollisionBlocks(curPlayer,oldPlayer);
      curPlayer.x=checkBlocks1.x;

      //Collision test on y movement
      curPlayer.y-=speed*curPlayer.inputs.moveUp;
      curPlayer.y+=speed*curPlayer.inputs.moveDown;

      var checkPlayers2 = testCollisionPlayers(curPlayer,oldPlayer,p);
      var checkBlocks2 = testCollisionBlocks(curPlayer,oldPlayer);
      curPlayer.x=checkPlayers1.x;
      curPlayer.x=checkBlocks1.x;
      curPlayer.y=checkPlayers2.y;
      curPlayer.y=checkBlocks2.y;

      for (var b in bonuses) {
        if (bonuses[b].active) {
          if (testCollision(curPlayer,bonuses[b])) {
            bonusesList[bonuses[b].bonus].activate(p);
            bonuses[b].active = false;
          };
        }
      }
    }

    if (!curPlayer.canAttack) {
      curPlayer.canAttack = (Date.now() - curPlayer.lastAttack.time >= weaponsList[curPlayer.lastAttack.weapon].shootInterval);
    }

    //Shooting
    if (curPlayer.alive && curPlayer.inputs.mouseDown && curPlayer.canAttack) {
      //Player can shoot!
      curPlayer.lastAttack.time = Date.now();
      curPlayer.lastAttack.weapon = curPlayer.curWeapon;
      attackWithWeapon(p);
      curPlayer.canAttack = false;
    }
  }

  for (var e in explosions) {
    if (explosions[e].curRadius >= explosions[e].fullRadius) {
      explosions[e].active = false;
    }else{
      explosions[e].curRadius = explosions[e].startRadius + explosions[e].fullRadius*( (Date.now()-explosions[e].startTime) / (explosions[e].finishTime-explosions[e].startTime) );
      if (explosions[e].curRadius > explosions[e].fullRadius) {
        explosions[e].curRadius = explosions[e].fullRadius;
      }
      //Check Collision
      for (var p in playerListSecure) {

        if (playerCanDamagePlayer(explosions[e].source,p)) {
          var cont = true;
          for (var i = 0; i < explosions[e].playersHit.length; i++) {
            if (explosions[e].playersHit[i] == p) {
              cont = false;
            }
          }
          if (cont) {
            var explInfo = checkExplosionCollision(explosions[e],playerListSecure[p]);
            if (explInfo.hit) {
              explosions[e].playersHit.push(p);
              damagePlayer(explInfo.damage,explosions[e].source,explosions[e].weapon,p);
            }
          }
        }
      }
    }
  }

  //Delete the inactive bullets
  var tempBullets = [];
  for (var bl = 0; bl < bullets.length; bl++) {
    if (bullets[bl].active) {
      tempBullets.push(bullets[bl])
    }
  }
  bullets = tempBullets;
  //Delete the inactive explosions
  var tempExplosions = [];
  for (var ex = 0; ex < explosions.length; ex++) {
    if (explosions[ex].active) {
      tempExplosions.push(explosions[ex]);
    }
  }
  explosions = tempExplosions;

  //Delete the inactive bonuses
  var tempBonuses = [];
  for (var b = 0; b < bonuses.length; b++) {
    if (bonuses[b].active) {
      tempBonuses.push(bonuses[b]);
    }
  }
  bonuses = tempBonuses;

  if (sendBullets) sendBulletList();
  if (sendBonuses) sendBonusesList();
  if (sendExplosions) sendExplosionsList();
  sendPlayerlistSecure();
}
function logPlayers() {
  setTimeout(function(){
    if (playersSinceLastLog > 0) {
      var d = new Date();
      var db = new Date();
      db.setTime(Date.now()-1000*60*60);
      console.log("On " + d.toLocaleDateString() + ", from " + db.toLocaleTimeString() + " to " + d.toLocaleTimeString() + ", there were a total of " + playersSinceLastLog + " logins.");
      playersSinceLastLog = clients.length;
      logPlayers()
    }
  },1000*60*60);
}

io.on('connection', function (socket) {
  var userId = socket.id;
  socket.on("enter-game",function(name) {
    socket.emit('your-id', userId);
    socket.emit('send-basic-player-info', playerListOpen);
    socket.emit('send-bonuses-info', bonuses);
    createNewPlayer(userId,name);
    clients.push(userId);
    if (playersSinceLastLog==0) logPlayers()
    playersSinceLastLog++;
  });
  socket.on('request-map',function(){
    io.emit('send-map',maps[currentMap].name,maps[currentMap].map,maps[currentMap].extrMap,maps[currentMap].bgcolor,gameMode);
  })
  socket.on('send-chat-message',function(msg) {
    io.emit('get-chat-message',userId,msg);
  });
  //Input
  socket.on("move-left",function(data){
    if (playerListSecure[userId]) {
      playerListSecure[userId].inputs.moveLeft = data;
    }
  })
  socket.on("move-right",function(data){
    if (playerListSecure[userId]) {
      playerListSecure[userId].inputs.moveRight = data;
    }
  })
  socket.on("move-up",function(data){
    if (playerListSecure[userId]) {
      playerListSecure[userId].inputs.moveUp = data;
    }
  })
  socket.on("move-down",function(data){
    if (playerListSecure[userId]) {
      playerListSecure[userId].inputs.moveDown = data;
    }
  })
  socket.on("mouse-down", function(md) {
    if (playerListSecure[userId]) {
      playerListSecure[userId].inputs.mouseDown = md;
    }
  })
  socket.on("new-mouse-pos", function(mpos) {
    if (playerListSecure[userId]) {
      playerListSecure[userId].inputs.mousePos = mpos;
    }
  });
  socket.on("swap-weapon", function(name) {
    if (playerListSecure[userId]) {
      if (weaponsList[name]) {
        playerListSecure[userId].curWeapon = name;
        socket.emit("new-weapon",name)
      }else{
        console.log("player used illegal weapon: " + name);
      }
    }
  });
  socket.on("use", function() {
    if (playerListSecure[userId]) {
      if (playerListSecure[userId].alive) {
        use(playerListSecure[userId]);
      }
    }
  });

  socket.on('pang', function() {
    socket.emit('peng');
  })

  socket.on('disconnect', function() {
    if (playerListOpen[userId] && playerListSecure[userId]) {
      deletePlayer(userId);
    }
  });
});

setInterval(update,1000/45); //45 fps like a  semi-god
setInterval(createBonus,20000);
setInterval(sendOpenPlayerList,10000); //Every 10 seconds, lets make sure we are synced
