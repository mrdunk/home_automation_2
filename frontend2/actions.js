/*global FlowObjectMqttSubscribe*/
/*global FlowObjectMqttPublish*/
/*exported dataReceived*/

var flow_objects = {component_mqtt_subscribe: FlowObjectMqttSubscribe,
                    component_mqtt_publish: FlowObjectMqttPublish,
                    component_read_file: FlowObjectReadFile,
                    component_map_values: FlowObjectMapValues,
                    component_map_labels: FlowObjectMapLabels,
                    //component_time_window: FlowObjectTimer,
                    component_add_time: FlowObjectAddTime,
                    component_combine: FlowObjectCombineData,
                    component_add_messages: FlowObjectAddData,
                    };

var missing_links = {};

var dataReceived = function(topic, backend_data){
  'use strict';
  console.log('dataReceived(', topic, backend_data, ')');

  var ha_control = document.getElementsByTagName('ha-control')[0];

  var index;
  for(index in flow_objects){
    if(index === backend_data.class_name){
      var flow_object = getFlowObjectByUniqueId(backend_data.unique_id);
      console.log(backend_data.unique_id, backend_data.version);
      if(flow_object && flow_object.version < backend_data.version){
        flow_object.delete();
        console.log(flow_object, flow_object.version, backend_data.version);
      }
      if(flow_object === undefined || flow_object.version < backend_data.version){
        flow_object = new flow_objects[index](ha_control.paper, ha_control.sidebar, ha_control.shareBetweenShapes, undefined, backend_data);
      }

      // Queue up links between objects so we can join them later.
      for(var port_label in backend_data.data.outputs){
        for(var i = 0; i < backend_data.data.outputs[port_label].length; i++){
          var target_unique_id = backend_data.data.outputs[port_label][i];
          missing_links[backend_data.unique_id] = target_unique_id;
        }
      }
    }
  }

  for(index in missing_links){
    var flow_object_out = getFlowObjectByUniqueId(index);
    if(flow_object_out !== undefined){
      var flow_object_in = getFlowObjectByUniqueId(missing_links[index]);
      if(flow_object_in !== undefined){
        var port_out = {'flow_object': flow_object_out, 'port_number': 0};
        var port_in = {'flow_object': flow_object_in, 'port_number': 0};
        flow_object_out.linkOutToIn(port_out, port_in);
        delete missing_links[index];
      }
    }
  }
  //console.log('missing_links:', missing_links);
};

