/*global Raphael*/

var PORT_HEIGHT = 15;
var PORT_WIDTH = 15;
var MIN_ARROW_LEN = 10;


var setBoxPosition = function(component, x, y){
  'use strict';
  if(component.type === "set"){
    for(var i = 0; i < component.items.length; i++){
      setBoxPosition(component.items[i], x, y);
    }
  } else {
    component.attr({x: x + component.x_offset, y: y + component.y_offset});
  }
};

Raphael.fn.arrow = function (pos1, pos2, color) {
  'use strict';
  if(Math.abs(pos1.x - pos2.x) + Math.abs(pos1.y - pos2.y) < MIN_ARROW_LEN){
    pos2.x = pos1.x + MIN_ARROW_LEN;
  }
  var dx = Math.abs(pos2.x - pos1.x);
  if(dx > 100){
    dx = 100;
  }
  if(dx < 20){
    dx = 20;
  }

  //var path = 'M ' + pos1.x + ' ' + pos1.y + ' L ' + pos2.x + ' ' + pos2.y;
  var path = 'M ' + pos1.x + ' ' + pos1.y + ' C ' + (pos1.x + dx) + ' ' + pos1.y + ' ' + (pos2.x - dx) + ' ' + pos2.y + ' ' + pos2.x + ' ' + pos2.y;
  return this.path(path).attr({stroke: color, fill: "none", 'stroke-width': 3, 'arrow-end': 'classic-wide'});
};

Raphael.el.dragArrow = function(pos2) {
  var path = this.attr('path');
  var pos1 = {x: path[0][1], y: path[0][2]};
  if(path[1][0] === 'C'){
    path[1][5] = pos2.x;
    path[1][6] = pos2.y;
  } else if (path[1][0] === 'L'){
    if(Math.abs(pos1.x - pos2.x) + Math.abs(pos1.y - pos2.y) >= MIN_ARROW_LEN){
      path[1][1] = pos2.x;
      path[1][2] = pos2.y;
    }
  }
  this.attr('path', path);
}


Raphael.fn.box = function(x, y, width, height, input_count, output_count, color){
  'use strict';
  var set_main = this.set();
  var shape = this.rect(x, y, width, height, 5);
  shape.label = 'container';
  shape.x_offset = 0;
  shape.y_offset = 0;
  set_main.push(shape);

  var set_content = this.set();
  shape = this.text(x + 5, y, "Test Text").attr({font: "12px Fontin-Sans, Arial", fill: "#fff", "text-anchor": "start"});
  shape.x_offset = 5;
  shape.y_offset = 8;
  shape.node.setAttribute("pointer-events", "none");
  set_content.push(shape);
  set_content.label = 'contents';
  set_main.push(set_content);

  var set_inputs = this.set();
  var i;
  for(i = 0; i < input_count; i++){
    shape = this.rect(x - PORT_WIDTH, y + PORT_HEIGHT + (i * PORT_HEIGHT), PORT_WIDTH, PORT_HEIGHT, 2);
    shape.x_offset = -PORT_WIDTH;
    shape.y_offset = PORT_HEIGHT + (i * PORT_HEIGHT);
    set_inputs.push(shape);
  }
  set_inputs.label = 'inputs';
  set_main.push(set_inputs);

  var set_outputs = this.set();
  for(i = 0; i < output_count; i++){
    shape = this.rect(x + width, y + PORT_HEIGHT + (i * PORT_HEIGHT), PORT_WIDTH, PORT_HEIGHT, 2);
    shape.x_offset = width;
    shape.y_offset = PORT_HEIGHT + (i * PORT_HEIGHT);
    set_outputs.push(shape);
  }
  set_outputs.label = 'outputs';
  set_main.push(set_outputs);

  var set_links = this.set();
  set_links.label = 'links';
  set_main.push(set_links);

  set_main.data('myset', set_main);

  set_main.attr({"fill": color, "stroke": "#000"});
  return set_main;
};

Raphael.st.setContents = function(content){
  'use strict';
  if(this.type === "set"){
    var pos = this.items[0].getBoxPosition();  // item 0 is the parent shape.
    var x = pos.x;
    var y = pos.y;
    for(var i = 0; i < this.items.length; i++){
      if(this.items[i].label === 'contents'){
        var node = this.items[i].pop();
        while(node){
          node.remove();
          node = this.items[i].pop();
        }
        var shape = this.paper.text(x + 5, y, content.object_name).attr({font: "12px Fontin-Sans, Arial", fill: "black", "text-anchor": "start"});
        shape.x_offset = 5;
        shape.y_offset = 8;
        shape.node.setAttribute("pointer-events", "none");
        this.items[i].push(shape);
        shape = this.paper.text(0, 0, content.data.general.instance_name.value).attr({font: "12px Fontin-Sans, Arial", fill: "black", "text-anchor": "start"});
        console.log(content.data.general.instance_name.value);
        shape.x_offset = 5;
        shape.y_offset = 22;
        shape.node.setAttribute("pointer-events", "none");
        this.items[i].push(shape);
        // For some reason new shapes added to a set do not appear until they are moved.
        setBoxPosition(this.items[i], x, y);
      }
    }
  }
};

Raphael.st.setInputs = function(input_count){
  'use strict';
  if(this.type === "set"){
    var pos = this.items[0].getBoxPosition();  // item 0 is the parent shape.
    var x = pos.x;
    var y = pos.y;
    var color = this.items[0].attr('fill');
    for(var i = 0; i < this.items.length; i++){
      if(this.items[i].label === 'inputs'){
        var node = this.items[i].pop();
        while(node){
          node.remove();
          node = this.items[i].pop();
        }
        for(var j = 0; j < input_count; j++){
          var shape = this.paper.rect(x - PORT_WIDTH, y + PORT_HEIGHT + (i * PORT_HEIGHT), PORT_WIDTH, PORT_HEIGHT, 2);
          shape.x_offset = -PORT_WIDTH;
          shape.y_offset = PORT_HEIGHT + (j * PORT_HEIGHT);
          shape.attr({"fill": color, "stroke": "#000"});
          this.items[i].push(shape);
        }
        // For some reason new shapes added to a set do not appear until they are moved.
        setBoxPosition(this.items[i], x, y);
      }
    }
  }
};

Raphael.st.setOutputs = function(output_count){
  'use strict';
  if(this.type === "set"){
    var pos = this.items[0].getBoxPosition();  // item 0 is the parent shape.
    var x = pos.x;
    var y = pos.y;
    var width = this.items[0].attr('width');
    var color = this.items[0].attr('fill');
    for(var i = 0; i < this.items.length; i++){
      if(this.items[i].label === 'outputs'){
        var node = this.items[i].pop();
        while(node){
          node.remove();
          node = this.items[i].pop();
        }
        for(var j = 0; j < output_count; j++){
          var shape = this.paper.rect(x + width, y + PORT_HEIGHT + (i * PORT_HEIGHT), PORT_WIDTH, PORT_HEIGHT, 2);
          shape.x_offset = width;
          shape.y_offset = PORT_HEIGHT + (j * PORT_HEIGHT);
          shape.attr({"fill": color, "stroke": "#000"});
          this.items[i].push(shape);
        }
        // For some reason new shapes added to a set do not appear until they are moved.
        setBoxPosition(this.items[i], x, y);
      }
    }
  }
};

/* Update link when the Output end is moved. */
Raphael.st.setOutputLinks = function(outputs){
  'use strict';
  var links, key_types;
  for(key_types in this.items){
    if(this.items[key_types].label === 'links'){
      links = this.items[key_types];
      var node = links.pop();
      while(node){
        node.remove();
        node = links.pop();
      }
    }
  }

  for(key_types in this.items){
    if(this.items[key_types].label === 'outputs'){
      for(var key_shape_output in this.items[key_types].items){
        for(var key_data_output in outputs){
          if(key_shape_output === key_data_output){
            var outgoing_port_shape = this.items[key_types][key_shape_output];
            for(var key_link in outputs[key_data_output].links){
              var incoming_port_index = outputs[key_data_output].links[key_link].input_port;
              var incoming_port_shape = outputs[key_data_output].links[key_link].box_object.shape.getPort('inputs', incoming_port_index);

              var pos1 = outgoing_port_shape.getShapePosition();
              var pos2 = incoming_port_shape.getShapePosition();
              pos1 = {x: pos1.x + PORT_WIDTH, y: pos1.y + PORT_HEIGHT /2};
              pos2 = {x: pos2.x, y: pos2.y + PORT_HEIGHT /2};
              if(Math.abs(pos1.x - pos2.x) + Math.abs(pos1.y - pos2.y) < MIN_ARROW_LEN){
                pos2.x = pos1.x + MIN_ARROW_LEN;
              }
              var shape = this.paper.arrow(pos1, pos2, 'teal');
              links.push(shape);
            }
          }
        }
      }
    }
  }
};

/* Update link when the Input end is moved. */
Raphael.st.setInputLinks = function(inputs){
  'use strict';
  var move_list = {};
  var key;
  for(key in inputs){
    if(inputs[key].links){
      for(var i = 0; i < inputs[key].links.length; i++){
        var output_object = inputs[key].links[i].box_object;
        move_list[output_object.unique_id] = output_object;
      }
    }
  }

  for(key in move_list){
    move_list[key].shape.setOutputLinks(move_list[key].data.data.outputs);
  }
};

Raphael.st.getPort = function(type, index){
  'use strict';
  for(var key_types in this.items){
    if(this.items[key_types].label === type){
      for(var key_port = 0; key_port < this.items[key_types].length; key_port++){
        if(key_port === index){
          return this.items[key_types][key_port];
        } 
      } 
    }
  } 
};

Raphael.st.setHighlight = function(color, thickness){
  'use strict';
  for(var key_types in this.data('myset').items){
    if(this.data('myset').items[key_types].label === 'container'){
      this.data('myset').items[key_types].setHighlight(color, thickness);
    }
  }
};

Raphael.el.setHighlight = function(color, thickness){
  'use strict';
  color = color || 'black';
  if(color === true){
    color = 'red';
    thickness = 3;
  }
  thickness = thickness || 1;

  for(var key_types in this.data('myset').items){
    if(this.data('myset').items[key_types].label === 'container'){
      this.data('myset').items[key_types].attr({stroke: color, 'stroke-width': thickness});
    }
  }
};

Raphael.el.getBoxPosition = function(){
  'use strict';
  return {x: this.data('myset')[0].attr("x"), y: this.data('myset')[0].attr("y")};
};

Raphael.el.getShapePosition = function(){
  'use strict';
  return {x: this.attr("x"), y: this.attr("y")};
};

Raphael.el.setBoxPosition = function(x, y){
  'use strict';
  setBoxPosition(this.data('myset'), x, y);
  this.data('myset').setOutputLinks(this.data('parent').data.data.outputs);
  this.data('myset').setInputLinks(this.data('parent').data.data.inputs);
};

