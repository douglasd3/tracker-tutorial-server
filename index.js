  var app = require('express')();
  var http = require('http').Server(app);
  var io = require('socket.io')(http);

  //List of all users currently sharing their location (tracked users)
  var trackedUsers = {}
  //List of all users currently tracking someones location (tracking users)
  var trackedUsersTrackers = {}

  app.get('/', function(req, res){
    res.send('<h1>Real time tracker</h1>');
  });

  http.listen(3000, function(){
    console.log('Listening on *:3000');
  });

  //-----------------------------------------------------------------------------------------------------//

  io.on('connection', function(clientSocket){
    console.log('a user connected');  

    //Messages received ---------------------------------------------------------------------------------//

    //When a user is disconnected from the server
    clientSocket.on('disconnect', function(){
      console.log('user disconnected');

      //Remove user from tracked user list
      disconnectTrackedUser(clientSocket.id); 

      //Let app know that we have a new tracked user list data
      emitTrackedUsersListUpdate();
    });

    //A user has started sharing location
    clientSocket.on("connectTrackedUser", function(nickname) {
      //Add user on the tracked user list
      connectTrackedUser(clientSocket.id, nickname)

      //Let the app knows that tracked users list was updated
      emitTrackedUsersListUpdate();
    });

    //A user has stopped sharing location
    clientSocket.on("disconnectTrackedUser", function() {        
      //Let everyone currently monitoring user location that the location is no longer been shared
      emitTrackedUserHasStoppedSharingLocation(clientSocket.id)

      //Remove user from the tracked user list
      disconnectTrackedUser(clientSocket.id);
      
      //Let app know that we have a new tracked user list data
      emitTrackedUsersListUpdate();
    });

    //When the app requests a updated list of tracked users (on app start for example)
    clientSocket.on("requestUpdatedTrackedUsersList", function() {       
      emitTrackedUsersListUpdate();
    });

    //A user has started tracking a user who is sharing location
    clientSocket.on("connectTrackedUserTracker", function(trackedUserSocketId) {
      connectTrackedUserTracker(trackedUserSocketId, clientSocket)
    });

    //A user has stopped tracking a user who is sharing location
    clientSocket.on("disconnectTrackedUserTracker", function(trackedUserSocketId) {
      disconnectTrackedUserTracker(trackedUserSocketId, clientSocket.id)
    });

    //Gets the coordinates of the tracked user and send it to her/his tracking users
    clientSocket.on("trackedUserCoordinates", function(latitude, longitude) {
      emitCoordinatesToTrackingUsers(clientSocket.id, latitude, longitude)      
    });

    //Helpers---------------------------------------------------------------------------------//

    //Function add a tracked user in tracked users list
    function connectTrackedUser(clientSocketId, nickname) {
      var message = "User " + nickname + " has started tracking. ";
      console.log(message);

      var trackedUserInfo = {};

      //The user socket id and nickname is stored and added into tracked users list
      trackedUserInfo["id"] = clientSocketId;
      trackedUserInfo["nickname"] = nickname;      

      trackedUsers[clientSocket.id] = trackedUserInfo;  
    }

    //Function remove a tracked user from tracked users list
    function disconnectTrackedUser(clientSocketId) {
      if (trackedUsers[clientSocketId] != null) {
        var message = "User " + trackedUsers[clientSocketId]["nickname"]+ " has stopped tracking. ";
        console.log(message);

        delete trackedUsers[clientSocketId]
        delete trackedUsersTrackers[clientSocketId]
      }
    }

    //Function add a tracking user in trackedUsersTrackers list
    function connectTrackedUserTracker(trackedUserSocketId, clientSocket) {
      if (trackedUsers[trackedUserSocketId] != null) {
        var message = "User " + clientSocket.id + " is traking " + trackedUsers[trackedUserSocketId]["nickname"]
        console.log(message);

        //Add the user socket into the tracking users list of a given tracked user (trackedUserSocketId)
        if (trackedUsersTrackers[trackedUserSocketId] == null) {
          trackedUsersTrackers[trackedUserSocketId] = []
        }

        trackedUsersTrackers[trackedUserSocketId].push(clientSocket);
      }
    }

    //Function remove a tracking user from trackedUsersTrackers list
    function disconnectTrackedUserTracker(trackedUserSocketId, clientSocketId) {
      if (trackedUsers[trackedUserSocketId] != null) {
        var message = "User " + clientSocketId + " has stopped tracking " + trackedUsers[trackedUserSocketId]["nickname"]
        console.log(message);

        //remove the user socket of the tracking users list
        for (index in trackedUsersTrackers[trackedUserSocketId]) {            
          if (trackedUsersTrackers[trackedUserSocketId][index].id == clientSocketId) {
            trackedUsersTrackers[trackedUserSocketId].splice(index, 1);
            break;
          }
        }
      }
    }

    //Messages to emit ---------------------------------------------------------------------------------//

    //Function send the tracked user coordinates to all her/his tracking users
    function emitCoordinatesToTrackingUsers(clientSocketId, latitude, longitude) {
      //Confirm if tracked user is still in the list
      if (trackedUsers[clientSocketId] != null) {
        var message = "Coordinates of " + trackedUsers[clientSocketId]["nickname"] + ": " + "Latitude " + latitude + " Longitude " + longitude;
        console.log(message);

        //Sends the coordinates for all users currently tracking the tracked user
        for (index in trackedUsersTrackers[clientSocketId]) {
          var socket = trackedUsersTrackers[clientSocketId][index]

          //Check if client socket is still connected before send coordinates 
          //We can use the connected property to make some validations in order to always keep track of connected users
          if (socket.connected) {
            var message = "Sending to " + socket.id + socket.connected;
            console.log(message);

            var coordinates = {};
            coordinates["latitude"] = latitude;
            coordinates["longitude"] = longitude;

            socket.emit("trackedUserCoordinatesUpdate", coordinates);   
          }
        }
      }
    }

    //Function that emmit for all users current tracking tracked user that she/he is no longger sharing location
    function emitTrackedUserHasStoppedSharingLocation(clientSocket) {
      for (index in trackedUsersTrackers[clientSocket]) {
        var socket = trackedUsersTrackers[clientSocket][index]

        if (socket.connected) {          
          socket.emit("trackedUserHasStoppedUpdate", trackedUsers[clientSocket]["nickname"]);   
        }
      }
    }

    //Function to send the updated list of tracked users
    function emitTrackedUsersListUpdate() {
      var trackedUsersList = Object.keys(trackedUsers).map(function(key){
        return trackedUsers[key];
      });

      io.emit("trackedUsersListUpdate", trackedUsersList);
    }

  });
