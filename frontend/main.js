

var Page = {}

Page.init = function() {
  Page.running_ = true;
  Page.fps_ = 10;
  Page.log_ = document.getElementById("log").getElementsByClassName("draw-elements")[0];
  Page.topics = {};
  Page.topics.solicit_all = 'homeautomation/lighting/all/all/solicit';

  document.getElementById("log").getElementsByClassName("draw-name")[0].innerHTML = "Log";
}

Page.run = function() {
}

Page.exit = function() {
  clearInterval(Page._intervalId_);
}

Page.AppendToLog = function(new_content) {
  var li = document.createElement("li");
  li.appendChild(document.createTextNode(new_content));
  Page.log_.appendChild(li)
}



var Mqtt = {}
Mqtt.reconnectTimeout = 2000;

Mqtt.MQTTconnect = function() {
  Mqtt.broker = new Messaging.Client( host, port, "web_" + parseInt(Math.random() * 100, 10));
  var options = {
      timeout: 3,
      useSSL: useTLS,
      cleanSession: cleansession,
      onSuccess: Mqtt.onConnect,
      onFailure: function (message) {
                 console.log("Connection failed: " + message.errorMessage + "Retrying");
                 setTimeout(MQTTconnect, Mqtt.reconnectTimeout);
      }
  };

  Mqtt.broker.onConnectionLost = Mqtt.onConnectionLost;
  Mqtt.broker.onMessageArrived = Mqtt.onMessageArrived;

  if (username != null) {
    options.userName = username;
    options.password = password;
  }
  console.log("Host="+ host + ", port=" + port + " TLS = " + useTLS + " username=" + username + " password=" + password);
  Mqtt.broker.connect(options);
}

Mqtt.onConnect = function() {
  console.log('Connected to ' + host + ':' + port);
  Mqtt.broker.subscribe(topic, {qos: 0});
  console.log('Subscribed to topic: ' + topic);
  Mqtt.send('solicit all', Page.topics.solicit_all);
}

Mqtt.onConnectionLost = function(response) {
  setTimeout(Mqtt.MQTTconnect, Mqtt.reconnectTimeout);
  console.log("connection lost: " + response.errorMessage + ". Reconnecting");
};

Mqtt.onMessageArrived = function(message) {
  var topic = message.destinationName;
  var payload = message.payloadString;

  Page.AppendToLog(topic + ' = ' + payload)

  var room = payload.split("/")[0]
  var device = payload.split("/")[1]
  var value = payload.split("/")[2]


  var rooms = document.body.getElementsByClassName("__rooms");
  var found_room = false;
  var found_device = false;
  var content_element = document.getElementById("content");
  for (var i=0, room_element; room_element = rooms[i]; i++) {
    if (xtag.hasClass(room_element, room)){
      found_room = room;

      var devices = room_element.getElementsByClassName("__devices");
      for (var i=0, device_element; device_element = devices[i]; i++) {
        if (xtag.hasClass(device_element, device)){
          found_device = device;
          device_element.element_value = value;
          break;
        }
      }

      if (found_device === false) {
        var new_device = document.createElement('draw-element');
        room_element.appendChild(new_device);
        new_device.element_name = device;
        new_device.element_value = value;
        //xtag.addClass(new_device, "__devices");
        //xtag.addClass(new_device, device);
      }
      break;
    }
  }
  if (found_room === false) {
      var new_room = document.createElement('draw-container');
      content_element.appendChild(new_room);
      //new_room.getElementsByClassName("draw-name")[0].innerHTML = room;
      new_room.draw_name = room;
      //xtag.addClass(new_room, "__rooms");
      //xtag.addClass(new_room, room);

      var new_device = document.createElement('draw-element');
      new_room.appendChild(new_device);
      new_device.element_name = device;
      new_device.element_value = value;
      //xtag.addClass(new_device, "__devices");
      //xtag.addClass(new_device, device);
  }
};

Mqtt.send = function(data, send_topic) {
  message = new Messaging.Message(data);
  message.destinationName = send_topic;
  message.qos = 0;
  Mqtt.broker.send(message);
};


window.onload = function() {
  Page.init();
  Page._intervalId_ = setInterval(Page.run, 1000 / Page.fps_);
  Mqtt.MQTTconnect();
};
