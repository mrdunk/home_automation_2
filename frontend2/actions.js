/*global FlowObjectMqttSubscribe*/
/*global FlowObjectMqttPublish*/
/*exported dataReceived*/

var flow_objects = {component_mqtt_subscribe: FlowObjectMqttSubscribe,
                    component_mqtt_publish: FlowObjectMqttPublish};

var dataReceived = function(topic, data){
  'use strict';
  console.log('dataReceived(', topic, data, ')');

  var ha_control = document.getElementsByTagName('ha-control')[0];

  var index;
  for(index in flow_objects){
    if(index === data.class_name){
      var flow_object = new flow_objects[index](ha_control.paper, ha_control.sidebar, ha_control.shareBetweenShapes);
      console.log("***", index, flow_object);
      flow_object.data.data.general.subscribed_topic.value = 'homeautomation/+/' + data.data.general.subscribed_topic;
      flow_object.setup(data.instance_name);

    }
  }
};
