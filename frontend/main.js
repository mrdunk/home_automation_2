var Data = {};

Data.init = function() {
  Data.device_tree_ = {};
}

Data.add = function(room, device, value){
  console.log(room, device, value);

  if (!Data.device_tree_[room]) {
    Data.device_tree_[room] = {};
  }
  Data.device_tree_[room][device] = value;
}



var Page = {}

Page.init = function() {
  Page.running_ = true;
  Page.fps_ = 1;
  Page.log_ = document.getElementById("log");
  Page.topics = {};
  Page.topics.solicit_all = 'homeautomation/lighting/all/all/solicit';
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
                 $('#status').val("Connection failed: " + message.errorMessage + "Retrying");
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

  Data.add(room, device, value);
  console.log(Data);
};

Mqtt.send = function(data, send_topic) {
  message = new Messaging.Message(data);
  message.destinationName = send_topic;
  message.qos = 0;
  Mqtt.broker.send(message);
};


window.onload = function() {
  Data.init();
  Page.init();
  Page._intervalId_ = setInterval(Page.run, 1000 / Page.fps_);
  Mqtt.MQTTconnect();
};
