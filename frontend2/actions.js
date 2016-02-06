/*global FlowObjectMqttSubscribe*/
/*global FlowObjectMqttPublish*/
/*exported dataReceived*/

var flow_objects = {FlowObjectMqttSubscribe: FlowObjectMqttSubscribe,
                    FlowObjectMqttPublish: FlowObjectMqttPublish,
                    FlowObjectReadFile: FlowObjectReadFile,
                    FlowObjectMapValues: FlowObjectMapValues,
                    FlowObjectMapLabels: FlowObjectMapLabels,
                    FlowObjectAddTime: FlowObjectAddTime,
                    FlowObjectCombineData: FlowObjectCombineData,
                    FlowObjectAddData: FlowObjectAddData,
                    FlowObjectFilterByTime: FlowObjectFilterByTime,
                    };


var dataReceived = function(topic, received_data){
  'use strict';
  console.log('dataReceived(', topic, received_data, ')');

  var ha_control = document.getElementsByTagName('ha-control')[0];

  var index;
  for(index in flow_objects){
    if(index === received_data.object_type){
      var flow_object = getFlowObjectByUniqueId(received_data.unique_id);
      console.log('', flow_object);
      if(received_data.data === undefined){
        received_data.data = {};
      }
      if(received_data.version === undefined){
        received_data.version = 0;
      }
        
      if(flow_object && flow_object.data.version < received_data.version){
        console.log('Removing:', flow_object.data.unique_id, flow_object.data.version, received_data.version);
        flow_object.delete(false);
      }
      if(flow_object === undefined || flow_object.data.version < received_data.version){
        console.log('Adding...', received_data);
        flow_object = new flow_objects[index](ha_control.paper, ha_control.sidebar, undefined, received_data);
        console.log('Added');
      }

      flow_object.shape.setOutputLinks(flow_object.data.data.outputs);

      console.log(received_data, flow_object.data);
    }
  }
  
  //console.log('dataReceived -');
};

