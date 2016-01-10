/*global FlowObjectMqttSubscribe*/
/*global FlowObjectMqttPublish*/
/*exported dataReceived*/

var flow_objects = {FlowObjectMqttSubscribe: FlowObjectMqttSubscribe,
                    FlowObjectMqttPublish: FlowObjectMqttPublish,
                    FlowObjectReadFile: FlowObjectReadFile,
                    FlowObjectMapValues: FlowObjectMapValues,
                    FlowObjectMapLabels: FlowObjectMapLabels,
                    //component_time_window: FlowObjectTimer,
                    FlowObjectAddTime: FlowObjectAddTime,
                    FlowObjectCombineData: FlowObjectCombineData,
                    FlowObjectAddData: FlowObjectAddData,
                    };


var dataReceived = function(topic, backend_data){
  'use strict';
  console.log('dataReceived(', topic, backend_data, ')');

  var ha_control = document.getElementsByTagName('ha-control')[0];

  var index;
  for(index in flow_objects){
    if(index === backend_data.object_name){
      var flow_object = getFlowObjectByUniqueId(backend_data.unique_id);
      if(backend_data.data === undefined){
        backend_data.data = {};
      }
      if(backend_data.version === undefined){
        backend_data.version = 0;
      }
        
      if(flow_object && flow_object.data.version < backend_data.version){
        console.log('Removing:', flow_object.data.unique_id, flow_object.data.version, backend_data.version);
        flow_object.delete(false);
      }
      if(flow_object === undefined || flow_object.data.version < backend_data.version){
        console.log('Adding...', backend_data);
        flow_object = new flow_objects[index](ha_control.paper, ha_control.sidebar, undefined, backend_data);
        console.log('Added');
      }

      for(var port_label in backend_data.data.outputs){
        for(var id in flow_object.data.data.outputs){
          if(flow_object.data.data.outputs[id].port_label === port_label){
            console.log(backend_data.data.outputs[port_label]);
            flow_object.data.data.outputs[id].links = backend_data.data.outputs[port_label];
          }
        }
      }
      flow_object.shape.setOutputLinks(flow_object.data.data.outputs);

      console.log(backend_data);
      console.log(flow_object.data);
    }
  }
  
  //console.log('dataReceived -');
};

