/*global FlowObjectMqttSubscribe*/
/*global FlowObjectMqttPublish*/
/*exported dataReceived*/

var flow_objects = {component_mqtt_subscribe: FlowObjectMqttSubscribe,
                    component_mqtt_publish: FlowObjectMqttPublish,
                    //component_map_values: FlowObjectMapValues,
                    //component_map_labels: FlowObjectMapValues,
                    //component_time_window: FlowObjectTimer,
                    //component_combine: FlowObjectCombineData,
                    //component_add_messages: FlowObjectCombineData,
                    };

var dataReceived = function(topic, backend_data){
  'use strict';
  //console.log('dataReceived(', topic, backend_data, ')');

  var ha_control = document.getElementsByTagName('ha-control')[0];

  var index;
  for(index in flow_objects){
    if(index === backend_data.class_name){
      var flow_object = getFlowObjectByUniqueId(backend_data.unique_id);
      console.log('**', backend_data.data.general, flow_object);
      if(flow_object === undefined){
        console.log("***", "new");
        flow_object = new flow_objects[index](ha_control.paper, ha_control.sidebar, ha_control.shareBetweenShapes, undefined, backend_data);
      }
      console.log("***", index, flow_object.unique_id);
//      flow_object.data.data.general.subscribed_topic.value = 'homeautomation/+/' + data.data.general.subscribed_topic;
    }
  }
};
