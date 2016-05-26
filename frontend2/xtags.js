/*global xtag*/
/*global Raphael*/

/*global Data*/

/*global FlowObjectTimer*/
/*global FlowObjectMqttSubscribe*/
/*global FlowObjectMqttPublish*/
/*global FlowObjectMapValues*/
/*global FlowObjectTestData*/
/*global FlowObjectCombineData*/

/*global getLink*/
/*global getLinks*/
/*global shareBetweenShapes*/
/*global currentHighlightOn*/
/*global currentHighlightOff*/
/*global getFlowObjectByUniqueId*/

/*global header_button_actions*/
/*global flow_object_classes*/

/*global LINK_THICKNESS*/
/*global LINK_HIGHLIGHT_THICKNESS*/
/*global SNAP*/

/*global SUBJECTS_ARE_TARGETS*/

/*exported FlowObjectCombineData*/
/*exported FlowObjectTestData*/
/*exported FlowObjectMapValues*/
/*exported FlowObjectMqttPublish*/
/*exported FlowObjectMqttSubscribe*/
/*exported FlowObjectTimer*/


(function() {
'use strict';


xtag.register('ha-control', {
  lifecycle:{
    created: function(){
      var template = document.getElementById('ha-control').innerHTML;
      xtag.innerHTML(this, template);
      this.paper = Raphael('ha-control-paper', '100%', '100%');
      this.header = document.getElementsByTagName('ha-control-heading')[0];
      this.header.setParent(this);
      this.menu = document.getElementsByTagName('ha-sidebar')[0];
      this.sidebar = document.getElementsByTagName('ha-sidebar')[1];
      this.flowObjects = {};
      this.links = [];
      this.menu.setAlign('left');
      //this.sidebar.setAlign('left');

      this.populateMenu();
    }
  },
  methods: {
    populateMenu: function(){
      this.menu.resize(200);

      var container = document.createElement('div');
      for(var i = 0; i < flow_object_classes.length; i++){
        var flow_object = new flow_object_classes[i]();
        var button = document.createElement('draggable-button');
        button.setContent(flow_object.data.class_label);
        button.setColor(flow_object.data.shape.color);
        button.setData({flow_object_id: i});
        container.appendChild(button);
      }
      this.menu.setContent(container);
    },
  },
  events: {
    drag: function(event){
      event.preventDefault();
    },
    dragover: function(event){
      event.preventDefault();
    },
    dragenter: function(event){
      event.preventDefault();
    },
		drop: function(event){
      //console.log('drop', event.clientX, event.dataTransfer.getData('client_x'));
      var x = event.clientX - document.getElementById('ha-control-paper').getBoundingClientRect().left;
      var y = event.clientY - document.getElementById('ha-control-paper').getBoundingClientRect().top;
      if(x > 0 && y > 0 && event.dataTransfer.getData('flow_object_id') !== ""){
        var constructor = flow_object_classes[event.dataTransfer.getData('flow_object_id')];
        var flow_object = new constructor(this.paper, this.sidebar, undefined, {});
        x -= parseFloat(event.dataTransfer.getData('offset_x')) * flow_object.shape[0].attr('width');
        y -= parseFloat(event.dataTransfer.getData('offset_y')) * flow_object.shape[0].attr('height');
        x += SNAP /2 - x % SNAP;
        y += SNAP /2 - y % SNAP;
        flow_object.setBoxPosition(x, y);

        flow_object.select();
        flow_object.ExportObject();
      }
    }
  }
});

xtag.register('ha-control-heading', {
  lifecycle:{
    created: function(){
      var template = document.getElementById('ha-control-heading').innerHTML;
      xtag.innerHTML(this, template);
    }
  },
  events: {
    'click:delegate(paper-icon-button)': function(){  //(mouseEvent){
      //console.log(mouseEvent, this);
      for(var button_id in header_button_actions){
        if(this.id === button_id){
          //console.log(button_id, header_button_actions[button_id]);
          header_button_actions[button_id]();
        }
      }
    }
  },
  methods: {
    setParent: function(parent){
      this.parent = parent;
    }
  },
});


xtag.register('ha-sidebar', {
  lifecycle:{
    created: function(){
      var template = document.getElementById('ha-sidebar').innerHTML;
      xtag.innerHTML(this, template);
      this.handle = this.getElementsByClassName('sidebar-handle')[0];
      this.setAlign('right');
    }
  },
  events: {
    'mousedown:delegate(div.sidebar-handle)': function(mouse_event){
			console.log('mousedown:delegate(div.sidebar-handle)');
      var sidebar = mouse_event.target;
      var counter = 0;
      while(counter < 10 && sidebar.tagName.toLowerCase() !== 'ha-sidebar'){
        counter++;
        sidebar = sidebar.parentElement;
      }
      if(sidebar === undefined){
        return;
      }

      if(mouse_event.target.setCapture){
        // Firefox has this nice .setCapture() that delegates all mouse events to this element.
			  mouse_event.target.setCapture();
      } else {
        // In Chrome we must use the document element.
        document.handleEvent = function(document_event) {
          switch(document_event.type) {
            case 'mousemove':
              if(this.pos_x !== document_event.clientX){
                this.pos_x = document_event.clientX;
                var delegated_event = new MouseEvent( 'mousemove', {bubbles: true, clientX: document_event.clientX, });
                mouse_event.target.dispatchEvent(delegated_event);
              }
              break;
            case 'mouseup':
              console.log('document.handleEvent mouseup');
              document.removeEventListener('mousemove', document, true);
              document.removeEventListener('mouseup', document, true);
              sidebar.mousedown = false;
              break;
          }
        };
        document.addEventListener('mousemove', document, true);
        document.addEventListener('mouseup', document, true);
      }

      sidebar.mousedown = true;
			sidebar.start_x = mouse_event.clientX;
    },
    'mouseup:delegate(div.sidebar-handle)': function(mouse_event){
			console.log('mouseup:delegate(div.sidebar-handle)');
      var sidebar = mouse_event.target;
      var counter = 0;
      while(counter < 10 && sidebar.tagName.toLowerCase() !== 'ha-sidebar'){
        counter++;
        sidebar = sidebar.parentElement;
      }
      if(sidebar === undefined){
        return;
      }

      sidebar.mousedown = false;
    },
    'mousemove:delegate(div.sidebar-handle)': function(mouse_event){
      //console.log('mousemove:delegate(div.sidebar-handle)');
      mouse_event.stopPropagation();
      var sidebar = mouse_event.target;
      var counter = 0;
      while(counter < 10 && sidebar.tagName.toLowerCase() !== 'ha-sidebar'){
        counter++;
        sidebar = sidebar.parentElement;
      }
      if(sidebar === undefined){
        return;
      }

      if(sidebar.mousedown){
	      sidebar = mouse_event.target;
  	    counter = 0; 
    	  while(counter < 10 && sidebar.tagName.toLowerCase() !== 'ha-sidebar'){
      	  counter++;
        	sidebar = sidebar.parentElement;
	      }
  	    if(sidebar === undefined){
    	    return;
      	}

        if(sidebar.align === 'right'){
          this.style.right = (sidebar.getBoundingClientRect().right - mouse_event.clientX - (this.getBoundingClientRect().width /2)) + 'px';
          sidebar.style.width = (sidebar.getBoundingClientRect().right - this.getBoundingClientRect().right -1) + 'px';
        } else {
          this.style.left = (-sidebar.getBoundingClientRect().left + mouse_event.clientX - (this.getBoundingClientRect().width /2) -2) + 'px';
          sidebar.style.width = (-sidebar.getBoundingClientRect().left + this.getBoundingClientRect().left -1) + 'px';
        }
      }
    }
  },
  methods: {
    resize: function(width){
      if(this.align === 'right'){
        this.style.width = (width - this.handle.getBoundingClientRect().width) + 'px';
        this.handle.style.right = (width - this.handle.getBoundingClientRect().width) + 'px';
      } else {
        this.style.width = (width - this.handle.getBoundingClientRect().width) + 'px';
        this.handle.style.left = (width - this.handle.getBoundingClientRect().width) + 'px';
      }
    },
    setAlign: function(align){
      this.align = align;
      if(align === 'right'){
        this.className = "ha-sidebar sidebar-right-align";
        this.handle.className = "sidebar-handle sidebar-handle-right-align";
      } else {
        this.className = "ha-sidebar sidebar-left-align";
        this.handle.className = "sidebar-handle sidebar-handle-left-align";
      }
    },
    setHeader: function(content){
      if(typeof(content) === 'string'){
        var element = document.createElement('div');
        element.innerHTML = content;
        content = element;
      }
      var header = this.getElementsByClassName('sidebar-header')[0];
      header.innerHTML = '';
      header.appendChild(content);
    },
    setContent: function(content){
      if(typeof(content) === 'string'){
        var element = document.createElement('div');
        element.innerHTML = content;
        content = element;
      }
      var container = this.getElementsByClassName('sidebar-content')[0];
      container.innerHTML = "";
      container.appendChild(content);
    }
  },
});

xtag.register('ha-flowobject-header', {
  lifecycle:{
    created: function(){
    }
  },
  methods: {
    populate: function(data, flow_object){
			var header_content = document.createElement('div');
      var header_text = document.createElement('span');
			header_text.className = 'text';
			var header_icon = document.createElement('span');
			header_icon.className = 'object-color';
			header_content.appendChild(header_text);
			header_content.appendChild(header_icon);

			var h1 = document.createElement('div');
			var h2 = document.createElement('div');
			var h3 = document.createElement('a');
			h1.innerHTML = data.data.general.instance_name.value;
			h2.innerHTML = data.unique_id + ' ' + data.version;
			h3.innerHTML = 'delete';
			h3.onclick=function(){console.log(this);
				this.delete();
			}.bind(flow_object);
			header_text.appendChild(h1);
			header_text.appendChild(h2);
			header_text.appendChild(h3);

			if(flow_object.getColor() === undefined){
				header_icon.style.height = '0';
				header_icon.style.visibility = "hidden";
			} else {
				header_icon.style.height = '2em';
				header_icon.style.visibility = "visible";
				header_icon.style.background = flow_object.getColor();
			}
			this.appendChild(header_content);
    }
  },
});

xtag.register('ha-flowobject-data', {
  lifecycle:{
    created: function(){
      var template = document.getElementById('ha-flowobject-data').innerHTML;
      xtag.innerHTML(this, template);
    }
  },
  methods: {
    populate: function(data, flow_object){
      //this.data = data;
      //this.flow_object = flow_object;

      var list_content = this.getElementsByClassName('general')[0];
			for(var general_id in data.general){
        if(data.general[general_id].updater){
          var general_attributes = document.createElement(data.general[general_id].updater);
          general_attributes.populate(data.general[general_id], flow_object);
      	  list_content.appendChild(general_attributes);
        }
			}

      list_content = this.getElementsByClassName('input')[0];
      for(var input_id in data.inputs){
        var input_attributes = document.createElement('ha-input-attributes');
        input_attributes.populate(data.inputs[input_id], input_id, flow_object);
        list_content.appendChild(input_attributes);
      }

      list_content = this.getElementsByClassName('output')[0];
      for(var output_id in data.outputs){
      	var output_attributes = document.createElement('ha-output-attributes');
				output_attributes.populate(data.outputs[output_id], output_id, flow_object);
				list_content.appendChild(output_attributes);
      }
    }
  },
});

xtag.register('ha-link-header', {
  lifecycle:{
    created: function(){
    }
  },
  methods: {
    populate: function(link_data){
      //console.log('ha-link-header.populate(', link_data, ')');
      var source_object = getFlowObjectByUniqueId(link_data.source_object);
      var destination_object = getFlowObjectByUniqueId(link_data.destination_object);

      var header_content = document.createElement('div');
      var header_text_from = document.createElement('span');
      header_text_from.className = 'text';
      var header_text_to = document.createElement('span');
      header_text_to.className = 'text';
      var header_spacer = document.createElement('span');
      header_spacer.className = 'text';
      
      header_text_from.innerHTML = source_object.data.data.general.instance_name.value + ':' + link_data.source_port;
      header_text_to.innerHTML = destination_object.data.data.general.instance_name.value + ':' + link_data.destination_port;
      header_spacer.innerHTML = '&nbsp;->&nbsp;';

      header_content.appendChild(header_text_from);
      header_content.appendChild(header_spacer);
      header_content.appendChild(header_text_to);


      this.appendChild(header_content);
    }
  },
});

xtag.register('ha-link-content', {
  lifecycle:{
    created: function(){
      //this.className = 'selectable';
    }
  },
  methods: {
    populate: function(link_data){
      console.log('ha-link-content.populate(', link_data, ')');
      this.innerHTML = '';

			//var source_object = getFlowObjectByUniqueId(link_data.source_object);
      //var destination_object = getFlowObjectByUniqueId(link_data.destination_object);

      var content = document.createElement('div');
      for(var thread in Data.mqtt_data.debug){
        for(var topic in Data.mqtt_data.debug[thread]){
          var debug_uid = topic.split('/')[0];
          var debug_port = topic.split('/')[2];
          if(link_data.source_object === debug_uid && link_data.source_port === debug_port){
            var line = document.createElement('ha-link-json');
            line.populate(Data.mqtt_data.debug[thread][topic]);
            content.appendChild(line);
          }
        }
      }
      this.appendChild(content);
    }
  },
});

xtag.register('ha-link-json', {
  methods: {
    populate: function(link_data){
      this.link_data = link_data;
      this.expanded = false;
      var content = document.createElement('pre');
      content.className = 'selectable';
      content.innerHTML = syntaxHighlight(link_data, this.expanded);
      this.appendChild(content);
      this.glow_intervals = [];
    },
    highlight_path: function(state){
			if(shareBetweenShapes.links_highlight === undefined){
				return;
			}
      var color = 'teal';
      if(state){
        color = 'darkorange';
      }

      function setHighlight(){
        var thickness = LINK_HIGHLIGHT_THICKNESS;
        if(this.track_glow){
          thickness = LINK_THICKNESS;
        }
        this.track_glow = !this.track_glow;
        this.link.shape.setHighlight(this.color, thickness);
      }

      for(var link_index in this.link_data.__trace){
        var link = getLink(this.link_data.__trace[link_index], false);
        if(link){
          if(state){
            link.shape.setHighlight(color, LINK_THICKNESS);
            var track_glow = true;
            this.glow_intervals.push(setInterval(setHighlight.bind({link:link, track_glow:track_glow, color:color}), 1000));
/*            this.glow_intervals.push(setInterval(function(){ var thickness = LINK_HIGHLIGHT_THICKNESS;
                                                             if(this.track_glow){
                                                               thickness = LINK_THICKNESS;
                                                             }
                                                             this.track_glow = !this.track_glow;
                                                             this.link.shape.setHighlight(this.color, thickness);
                                                           }.bind({link:link, track_glow:track_glow, color:color}), 1000));*/
          } else {
            while(this.glow_intervals.length){
              clearInterval(this.glow_intervals.pop());
            }
            link.shape.setHighlight(color, LINK_THICKNESS);
          }
        }
      }
    }
  },
  events: {
    tap: function(){
      this.expanded = !this.expanded;
      this.innerHTML = '';
      var content = document.createElement('pre');
      content.className = 'selectable';
      content.innerHTML = syntaxHighlight(this.link_data, this.expanded);
      this.appendChild(content);
			this.highlight_path(false);
			shareBetweenShapes.links_highlight = undefined;
    },
    enter: function(){
      //console.log('ha-link-json.enter', this.link_data.__trace);
      shareBetweenShapes.links_highlight = this.link_data.__trace;
			this.highlight_path(true);
    },
    leave: function(){
      //console.log('ha-link-json.leave');
			this.highlight_path(false);
      shareBetweenShapes.links_highlight = undefined;
    }
  }
});

// Json pretty print:
//   http://stackoverflow.com/questions/4810841/how-can-i-pretty-print-json-using-javascript
function syntaxHighlight(json, expand) {
    if (typeof json !== 'string') {
      if(!expand){
			  json = JSON.stringify(json, replacer);
      } else {
        json = JSON.stringify(json, replacer, 2);
      }
    }
    json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, function (match) {
        var cls = 'number';
        if (/^"/.test(match)) {
            if (/:$/.test(match)) {
                cls = 'key';
            } else {
                cls = 'string';
            }
        } else if (/true|false/.test(match)) {
            cls = 'boolean';
        } else if (/null/.test(match)) {
            cls = 'null';
        }
        return '<span class="' + cls + '">' + match + '</span>';
    });
}

function replacer(key, value) {
  if(key.substr(0,2) === '__'){
    return;
  }
  return value;
}

xtag.register('ha-input-attributes', {
  lifecycle:{
    created: function(){
      var template = document.getElementById('ha-input-attribute').innerHTML;
      xtag.innerHTML(this, template);
    }
  },
  methods: {
    populate: function(data, input_id, flow_object){
      //console.log(data);
      this.getElementsByClassName('description')[0].innerHTML = data.description || input_id;
      var form = this.getElementsByClassName('form')[0];

      // Modifiable attributes.
      for(var label in data){
        if(typeof(data[label]) === 'object'){
          var general_attributes = document.createElement(data[label].updater);
          general_attributes.populate(data[label], flow_object);
          form.appendChild(general_attributes);
        }
      }
    }
  }
});

xtag.register('ha-output-attributes', {
  lifecycle:{
    created: function(){
      var template = document.getElementById('ha-output-attribute').innerHTML;
      xtag.innerHTML(this, template);
    }
  },
  methods: {
    populate: function(data, output_id, flow_object){
      this.getElementsByClassName('description')[0].innerHTML = data.description || output_id;
      var form = this.getElementsByClassName('form')[0];

      // Modifiable attributes.
      for(var label in data){
        if(typeof(data[label]) === 'object'){
          if(label === 'links'){
            for(var index in data.links){
              var link = document.createElement('ha-link-info');
              link.populate(data.links[index]);
              form.appendChild(link);                
            }
          } else {
						var general_attributes = document.createElement(data[label].updater);
						general_attributes.populate(data[label], flow_object);
						form.appendChild(general_attributes);
          }
        }
      }
    }
  }
});

xtag.register('ha-link-info', {
  methods: {
    populate: function(link_data){
      this.link_data = link_data;
      xtag.innerHTML(this, '');
      var destination_object = getFlowObjectByUniqueId(link_data.destination_object);
      if(destination_object){
        var header = document.createElement('div');
        header.innerHTML = 'link: ';
        var link_destination = document.createElement('div');
        link_destination.innerHTML = destination_object.data.data.general.instance_name.value + ':' + link_data.destination_port;
        var info_button = document.createElement('paper-icon-button');
        info_button.icon = 'subject';
        this.appendChild(header);
        this.appendChild(info_button);
        this.appendChild(link_destination);
      } else {
        this.innerHTML = 'link: ' + link_data.destination_object + ':' + link_data.destination_port;
      }
    }
  },
  events: {
    'click:delegate(paper-icon-button)': function(mouseEvent){
      var transition;
      for (var i = 0; i < mouseEvent.path.length; i++){
        if(xtag.matchSelector(mouseEvent.path[i], 'ha-link-info')){
          transition = mouseEvent.path[i];
          break;
        }
      }
      currentHighlightOff();
      shareBetweenShapes.selected = transition.link_data;
      currentHighlightOn();
      getLink(shareBetweenShapes.selected).displaySideBar();
    }
  }
});

xtag.register('ha-general-attribute', {
  lifecycle:{
    created: function(){
      var template = document.getElementById('ha-general-attribute').innerHTML;
      xtag.innerHTML(this, template);
    },
  },
  methods: {
    populate: function(data, flow_object){
      this.getElementsByClassName('description')[0].innerHTML = data.description;
			var input;
      if(data.form_type === 'textarea'){
        input = document.createElement(data.form_type);
        input.rows = 4;
        input.cols = 50;
			} else if(data.form_type === 'checkbox'){
				input = document.createElement('input');
				input.type = 'checkbox';
				if(data.value === true || (typeof(data.value) === 'string' && data.value.toLowerCase() === 'true')){
          input.checked = true;
				}
      } else if(data.form_type === 'number'){
        input = document.createElement('input');
        input.type = 'number';
      } else {
        input = document.createElement("input");
      }
			input.value = data.value;
			input.onchange = this.update_callback.bind({element: input, data: data, flow_object: flow_object});
			this.getElementsByClassName('form')[0].appendChild(input);
    },
    update_callback: function(update_event){
      console.log('update_callback', this, update_event);

      var value = this.element.value;
      if(this.element.type === 'checkbox'){
        value = this.element.checked;
      }

      if(this.data.update_on_change){
        // Some special activity is requested when this field changes.
        if(typeof this.data.update_on_change === 'function'){
          // We have a callback function to deal with this field.
          this.data.update_on_change.call(this.flow_object, value);
        } else {
          // Just save the data.
          this.data.value = value;
        }

        // Update the sidebar.
        this.flow_object.displaySideBar();
      } else {
        // No special activity requested when this field changes. Just save the data.
        this.data.value = value;
      }

      // Now export a copy on Mqtt.
      this.flow_object.ExportObject();
    }
  }
});


xtag.register('ha-select-label', {
  lifecycle:{
    created: function(){
    },
  },
  methods: {
    populate: function(data){
			var label = data.value;
      var value_tag = document.createElement('input');
      value_tag.setAttribute('list', 'label|' + label);
      value_tag.setAttribute('name', 'label|' + label);
      value_tag.setAttribute('value', label);

      var datalist = document.createElement('DATALIST');
      datalist.setAttribute('id', 'label|' + label);
      var labels = Data.getLabels();
      var i;
      for(i = 0; i < labels.length; i++){
        var option = document.createElement("OPTION");
        option.setAttribute("value", labels[i]);
        datalist.appendChild(option);
      }
      this.appendChild(value_tag);
      this.appendChild(datalist);
    }
  }
});


xtag.register('ha-topic-chooser', {
  lifecycle:{
    created: function(){
      var template = document.getElementById('ha-output-attribute').innerHTML;
      xtag.innerHTML(this, template);
    },
  },
  methods: {
    populate: function(data, flow_object){
      this.getElementsByClassName('description')[0].innerHTML = data.description;

      this.flow_object = flow_object;
      var topic_list = [];
      var key;
      for(key in Data.mqtt_data.announcments){
        if(typeof(key) === 'string' && key !== 'updated' && typeof(Data.mqtt_data.announcments[key]) === 'object'){
          topic_list.push(key);

          if(SUBJECTS_ARE_TARGETS.indexOf(key) >= 0){
            for(var i=0; i < Data.mqtt_data.announcments[key].length; i++){
              topic_list.push(Data.mqtt_data.announcments[key][i]._subject);
            }
          }
        }
      }
      //topic_list = Data.ExpandTopics(topic_list);

      var container = document.createElement('span');
      this.getElementsByClassName('form')[0].appendChild(container);

      var topic_header = document.createElement('div');
      topic_header.innerHTML = 'homeautomation/+/';
      container.appendChild(topic_header);

      var input_wrapper = document.createElement('div');
      container.appendChild(input_wrapper);

      var input = document.createElement('input');
      input.setAttribute('list', 'topics');
      input.setAttribute('name', 'topics');
      input.setAttribute('value', data.value);
      input_wrapper.appendChild(input);

      var datalist = document.createElement('DATALIST');
      datalist.id = 'topics';
      this.appendChild(datalist);
			var option = document.createElement("OPTION");
			option.setAttribute("value", '');
			datalist.appendChild(option);
      for(key in topic_list){
        option = document.createElement("OPTION");
        option.setAttribute("value", topic_list[key]);
        datalist.appendChild(option);
      }

      input.onchange = this.update_callback.bind({element: input, data: data, flow_object: flow_object});
    },
    update_callback: function(update_event){
      console.log('update_callback', this, update_event);
			this.data.value = this.element.value;

			this.flow_object.setContents();
      this.flow_object.displaySideBar();
    }
  }
});

xtag.register('draggable-button', {
  lifecycle:{
    created: function(){
      xtag.innerHTML(this, '<div>db</div>');
      this.setAttribute('draggable', true);
    },
  },
  events: {
    drag: function(event){
      event.preventDefault();
    },
    dragover: function(event){
      event.preventDefault();
    },
    dragenter: function(event){
      event.preventDefault();
    },
    dragstart: function(event){
      console.log('dragstart:', event, this.data);
      this.style.opacity = '0.4';
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('flow_object_id', this.data.flow_object_id);
      event.dataTransfer.setData('offset_x', event.offsetX / this.getBoundingClientRect().width);
      event.dataTransfer.setData('offset_y', event.offsetY / this.getBoundingClientRect().height);
    },
    dragend: function(){
      //console.log('dragend:', event);
      this.style.opacity = '1';
    },
    drop: function(event){
      event.preventDefault();
      //console.log('drop:', event);
    }
  },
  methods: {
    setContent: function(content){
      if(typeof(content) === 'string'){
        var element = document.createElement('div');
        element.innerHTML = content;
        content = element;
      }
      this.innerHTML = "";
      this.appendChild(content);
    },
    setData: function(data){
      this.data = data;
    },
    setColor: function(color){
      this.style.background = color;
    }
  }
});

xtag.register('ha-switch-rules', {
  methods: {
    populate: function(data, flow_object){
			console.log('ha-switch-rules(', data, flow_object, ')');

      this.data = data;
      this.flow_object = flow_object;

      var labels_content = document.createElement('ha-general-attribute');
      labels_content.populate(data.filter_on_label, flow_object);
      this.appendChild(labels_content);

			for(var i=0; i < data.values.rules.length; i++){
				var rule = document.createElement('ha-switch-rule');
        data.values.rules[i].rule_number = i;
        rule.populate(data.values.rules[i], flow_object);
        this.appendChild(rule);
			}

      var add_button_container = document.createElement('div');
      add_button_container.className = 'ha-switch-rule';
      add_button_container.id = 'ha-add-rule';
      var add_button = document.createElement('button');
      add_button.className = 'ha-switch-rule-button';
      add_button.textContent = '+';
      add_button.value = 'add_rule';
      add_button_container.appendChild(add_button);
      this.appendChild(add_button_container);

			var rule_else = document.createElement('ha-switch-rule-else');
      rule_else.populate(data.values.otherwise, flow_object);
      this.appendChild(rule_else);
    }
  },
  events: {
    'click:delegate(button)': function(mouseEvent){
      console.log(mouseEvent.srcElement.value);

      var parent = mouseEvent.currentTarget;

			var click_value = mouseEvent.srcElement.value;
			if(click_value === 'add_rule'){
        var rule = document.createElement('ha-switch-rule');
        var data = {rule_number: parent.data.values.rules.length,
                    if_type: 'bool',
                    if_value: true,
                    send_to: 'branch_1'};
        parent.data.values.rules.push(data);
        rule.populate(data, parent.flow_object);
        //parent.appendChild(rule);
        parent.insertBefore(rule, document.getElementById('ha-add-rule'));
      } else if(click_value.split('|')[0] === 'remove_rule') {
        // Remove from data.
        var rule_index = parseInt(click_value.split('|')[1]);
        parent.data.values.rules.splice(rule_index, 1);
        // Remove the last visible rule element.
        parent.removeChild(parent.getElementsByTagName('ha-switch-rule')[0]);
				// Now update all remaining rules to make sure they reflect the data.
        for(var i=0; i < parent.getElementsByTagName('ha-switch-rule').length; i++){
          parent.data.values.rules[i].rule_number = i;
          parent.getElementsByTagName('ha-switch-rule')[i].populate(parent.data.values.rules[i], parent.flow_object);
        }
      }
    },
    'click:delegate(select)': function(mouseEvent){
      var parent = mouseEvent.currentTarget;

      var click_value = mouseEvent.srcElement.value;
			
			var click_type = click_value.split('|')[0];
      var rule_value = click_value.split('|')[1];
      var rule_index = click_value.split('|')[2];
      if(!isNaN(parseInt(rule_index))){ rule_index = parseInt(rule_index); }

			console.log(click_type, rule_value, rule_index);

			if(click_type === 'if_type') {
        parent.data.values.rules[rule_index].if_type = rule_value;
        parent.getElementsByTagName('ha-switch-rule-filter')[rule_index].populate(parent.data.values.rules[rule_index], parent);

        var description = if_types[rule_value].description;
			  parent.getElementsByTagName('ha-switch-rule')[rule_index].getElementsByClassName('ha-switch-rule-description')[0].innerHTML = description;
      } else if(click_type === 'send_to') {
        if(rule_index === 'else'){
          parent.data.values.otherwise.send_to = rule_value;
        } else {
          parent.data.values.rules[rule_index].send_to = rule_value;
        }
      }
    }
  }
});

var if_types = {bool: {text: 'boolean',
                       description: 'Contents of "boolean" type are either True or False.'},
                number: {text: 'number',
                         description: 'Contents of "number" type are a number.'},
                string: {text: 'string',
                         description: 'Contents match the text string.'},
                missing: {text: 'missing',
                          description: 'Label not found in data.'},
                exists: {text: 'exists',
                         description: 'Label found in data. Don\'t care about the contents.'},
                _else: {text: 'else',
                         description: 'If none of the above match, do this.'}
};

xtag.register('ha-switch-rule', {
  methods: {
    populate: function(data, flow_object){
      this.className = 'ha-switch-rule';
      this.innerHTML = '';
			var remove_button = document.createElement('button');
      remove_button.className = 'ha-switch-rule-button';
      remove_button.textContent = '-';
      remove_button.value = 'remove_rule|' + data.rule_number;
      this.appendChild(remove_button);

      var selector = document.createElement('div');
      selector.className = 'ha-switch-rule-selector';
      this.appendChild(selector);

      var if_type = document.createElement('select');
      for(var if_type_opt_str in if_types){
        var if_type_option = document.createElement("option");
        if_type_option.text = if_types[if_type_opt_str].text;
        if_type_option.value = 'if_type|' + if_type_opt_str + '|' + data.rule_number;
        if(if_type_opt_str === data.if_type){
          if_type_option.selected = true;
        }
        if_type.add(if_type_option);
      }
      selector.appendChild(if_type);

			var if_value = document.createElement('ha-switch-rule-filter');
			if_value.populate(data, flow_object);
			selector.appendChild(if_value);

      var send_to = document.createElement('select');
      var output;
      for(var output_name in flow_object.data.data.outputs){
        output = document.createElement("option");
        output.text = output_name;
        output.value = 'send_to|' + output_name + '|' + data.rule_number;
        if(output_name === data.send_to){
          output.selected = true;
        }
        send_to.add(output);
      }
      this.appendChild(send_to);

      var description = document.createElement('div');
      description.className = 'ha-switch-rule-description';
      description.innerHTML = if_types[if_type.value.split('|')[1]].description;
      this.appendChild(description);
    }
	}
});

xtag.register('ha-switch-rule-else', {
  methods: {
    populate: function(data, flow_object){
      this.className = 'ha-switch-rule';
      this.innerHTML = '';
      var remove_button = document.createElement('div');
      remove_button.className = 'ha-switch-rule-button';
      this.appendChild(remove_button);

      var selector = document.createElement('div');
      selector.className = 'ha-switch-rule-selector';
      selector.innerHTML = 'else:';
      this.appendChild(selector);

      var send_to = document.createElement('select');
      var output;
      for(var output_name in flow_object.data.data.outputs){
        output = document.createElement("option");
        output.text = output_name;
        output.value = 'send_to|' + output_name + '|else';
        if(output_name === data.send_to){
          output.selected = true;
        }
        send_to.add(output);
      }
      this.appendChild(send_to);

      var description = document.createElement('div');
      description.className = 'ha-switch-rule-description';
      //description.innerHTML = if_types['_else'].description;
      description.innerHTML = if_types._else.description;
      this.appendChild(description);
		}
  }
});

xtag.register('ha-switch-rule-filter', {
  methods: {
    populate: function(data, flow_object){
      this.innerHTML = '';
      var ret_val;
      switch(data.if_type){
        case 'bool':
          ret_val = document.createElement('ha-switch-rule-filter-bool');
          ret_val.populate(data, flow_object);
          this.appendChild(ret_val);
          break;
        case 'number':
          ret_val = document.createElement('ha-switch-rule-filter-number');
          ret_val.populate(data, flow_object);
          this.appendChild(ret_val);
          break;
        case 'string':
          ret_val = document.createElement('ha-switch-rule-filter-string');
          ret_val.populate(data, flow_object);
          this.appendChild(ret_val);
          break;
				case 'missing':
					break;
        case 'exists':
          break;
        default:
          ret_val = document.createElement('input');
          ret_val.value = data.if_value;
          this.appendChild(ret_val);
      }
    }
  }
});


xtag.register('ha-switch-rule-filter-bool', {
  methods: {
    populate: function(data){
      var selector = document.createElement('select');
      var output_true = document.createElement("option");
      output_true.text = '= True';
      output_true.value = 'if_value|true|' + data.rule_number;
      selector.add(output_true);
      var output_false = document.createElement("option");
      output_false.text = '= False';
      output_false.value = 'if_value|false|' + data.rule_number;
      selector.add(output_false);
			this.appendChild(selector);

			if(data.if_value === true || data.if_value === 'true'){
        output_true.selected = true;
			} else {
        output_false.selected = true;
      }
    }
  },
  events: {
    'click:delegate(select)': function(mouseEvent){
      var parent;
      for (var i = 0; i < mouseEvent.path.length; i++){
        if(xtag.matchSelector(mouseEvent.path[i], 'ha-switch-rules')){
          parent = mouseEvent.path[i];
          break;
        }
      }
      if(parent === undefined){
        return;
      }

      var click_value = mouseEvent.srcElement.value;

			var click_type = click_value.split('|')[0];
			var rule_value = click_value.split('|')[1];
			var rule_index = parseInt(click_value.split('|')[2]);
			if(click_type === 'if_value') {
				console.log('ha-switch-rule-filter-bool', click_type, rule_value, rule_index);
				parent.data.values.rules[rule_index].if_value = rule_value;
      }
		}
  }
});

xtag.register('ha-switch-rule-filter-number', {
  methods: {
    populate: function(data) {
      var selector = document.createElement('select');
      var selector_options = {lt: '<',
                              lteq: '<=',
                              eq: '=',
                              gteq: '>=',
                              gt: '>',
                              noteq: '!='};
      for(var val in selector_options){
        var option = document.createElement("option");
        option.text = selector_options[val];
        option.value = 'if_value_opperand|' + val + '|' + data.rule_number;
        if(data.if_value.opperand === val){
          option.selected = true;
        }
        selector.add(option);
      }
      this.appendChild(selector);

      var value = document.createElement('input');
      value.type = 'number';
      value.value = data.if_value.value;
      value.id = 'if_value_value|_na|' + data.rule_number;
      this.appendChild(value);
    }
  },
  events: {
    'click:delegate(select,input)': function(mouseEvent){
      var parent;
      for (var i = 0; i < mouseEvent.path.length; i++){
        if(xtag.matchSelector(mouseEvent.path[i], 'ha-switch-rules')){
          parent = mouseEvent.path[i];
          break;
        }
      }
      if(parent === undefined){
        return;
      }

      var click_value = mouseEvent.srcElement.id || mouseEvent.srcElement.value;

      var click_type = click_value.split('|')[0];
      var rule_value = click_value.split('|')[1];
      var rule_index = parseInt(click_value.split('|')[2]);
      if(rule_value === '_na'){
        rule_value = mouseEvent.srcElement.value;
      }
      console.log('ha-switch-rule-filter-number', click_type, rule_value, rule_index, parent);
      if(click_type === 'if_value_opperand') {
        var value = parent.rules.getElementsByTagName('ha-switch-rule')[rule_index].getElementsByTagName('input')[0].value;
        parent.data.values.rules[rule_index].if_value = {opperand: rule_value,
                                                         value: value};
      } else if(click_type === 'if_value_value') {
        var opperand = parent.rules.getElementsByTagName('ha-switch-rule')[rule_index].getElementsByTagName('select')[1].value.split('|')[1];
        parent.data.values.rules[rule_index].if_value = {opperand: opperand,
                                                         value: rule_value};
      }
    }
  }
});

xtag.register('ha-switch-rule-filter-string', {
  methods: {
    populate: function(data){
      var selector = document.createElement('select');
      var selector_options = {matches: 'matches',
                              nomatch: 'doesn\'t match',
                              contains: 'contains',
                              nocontain: 'doesn\'t contain'};
      for(var val in selector_options){
        var option = document.createElement("option");
        option.text = selector_options[val];
        option.value = 'if_value_opperand|' + val + '|' + data.rule_number;
        if(data.if_value.opperand === val){
          option.selected = true;
        }
        selector.add(option);
      }
      this.appendChild(selector);

      var value = document.createElement('input');
      value.value = data.if_value.value;
      value.id = 'if_value_value|_na|' + data.rule_number;
      this.appendChild(value);
    }
  },
  events: {
    'click:delegate(select,input)': function(mouseEvent){
      var parent;
      for (var i = 0; i < mouseEvent.path.length; i++){
        if(xtag.matchSelector(mouseEvent.path[i], 'ha-switch-rules')){
          parent = mouseEvent.path[i];
          break;
        }
      }
      if(parent === undefined){
        return;
      }

      var click_value = mouseEvent.srcElement.id || mouseEvent.srcElement.value;

      var click_type = click_value.split('|')[0];
      var rule_value = click_value.split('|')[1];
      var rule_index = parseInt(click_value.split('|')[2]);
      if(rule_value === '_na'){
        rule_value = mouseEvent.srcElement.value;
      }
      console.log('ha-switch-rule-filter-number', click_type, rule_value, rule_index, parent);
      if(click_type === 'if_value_opperand') {
        var value = parent.getElementsByTagName('ha-switch-rule')[rule_index].getElementsByTagName('input')[0].value;
        parent.data.values.rules[rule_index].if_value = {opperand: rule_value,
                                                         value: value};
      } else if(click_type === 'if_value_value') {
        var opperand = parent.getElementsByTagName('ha-switch-rule')[rule_index].getElementsByTagName('select')[1].value.split('|')[1];
        parent.data.values.rules[rule_index].if_value = {opperand: opperand,
                                                         value: rule_value};
      }
    },
    'focusout:delegate(input)': function(mouseEvent){
      console.log('onfocusout');
      var parent;
      for (var i = 0; i < mouseEvent.path.length; i++){
        if(xtag.matchSelector(mouseEvent.path[i], 'ha-switch-rules')){
          parent = mouseEvent.path[i];
          break;
        }
      }
      if(parent === undefined){
        return;
      }

      var click_value = mouseEvent.srcElement.id || mouseEvent.srcElement.value;

      var click_type = click_value.split('|')[0];
      var rule_value = click_value.split('|')[1];
      var rule_index = parseInt(click_value.split('|')[2]);
      if(rule_value === '_na'){
        rule_value = mouseEvent.srcElement.value;
      }
      console.log('ha-switch-rule-filter-number', click_type, rule_value, rule_index);
			if(click_type === 'if_value_value') {
        var opperand = parent.getElementsByTagName('ha-switch-rule')[rule_index].getElementsByTagName('select')[1].value.split('|')[1];
        parent.data.values.rules[rule_index].if_value = {opperand: opperand,
                                                         value: rule_value};
      }
    }
  }
});

xtag.register('ha-modify-labels-rules', {
  methods: {
    populate: function(data, flow_object){
      console.log('ha-modify-labels-rules(', data, flow_object, ')');

      this.data = data;
      this.flow_object = flow_object;

      this.innerHTML = '';

      this.add_button_container = document.createElement('div');
      this.add_button_container.className = 'ha-switch-rule';
      this.add_button_container.id = 'ha-add-rule';
      this.appendChild(this.add_button_container);

			for(var i=0; i < data.values.rules.length; i++){
        var new_rule = document.createElement('ha-modify-labels-rule');
        new_rule.populate(data.values.rules[i], this.data);
        this.add_button_container.appendChild(new_rule);
			}

      var add_button = document.createElement('button');
      add_button.className = 'ha-switch-rule-button';
      add_button.textContent = '+';
      add_button.value = 'add_rule';
      this.appendChild(add_button);

    },
  },
  events: {
    'click:delegate(button)': function(mouseEvent){
      console.log(mouseEvent.srcElement.value, this);
      var parent = mouseEvent.currentTarget;

      if(mouseEvent.srcElement.value === 'add_rule'){
        var new_rule = document.createElement('ha-modify-labels-rule');
        new_rule.populate({rule_number: parent.data.values.rules.length}, parent.data);
        parent.add_button_container.appendChild(new_rule);
      }
    }
  }
});

var actions = {rename: {text: 'rename',
                        description: 'Rename the label.'},
               drop: {text: 'drop',
                      description: 'Remove this label from data.'},
              };

xtag.register('ha-modify-labels-rule', {
  methods: {
    populate: function(rule_data, data){
      this.data = data;

      if(this.data.values.rules.length <= rule_data.rule_number){
        this.data.values.rules.push(rule_data);
      }
      console.log(this.data.values.rules, rule_data.rule_number);

      var remove_button = document.createElement('button');
      //remove_button.className = 'ha-switch-rule-button';
      remove_button.textContent = '-';
      remove_button.value = 'remove_rule|' + rule_data.rule_number;
      this.appendChild(remove_button);

      var source_label = document.createElement('ha-label-chooser');
      this.appendChild(source_label);

      var action = document.createElement('select');
      for(var action_opt_str in actions){
        var action_option = document.createElement("option");
        action_option.text = actions[action_opt_str].text;
        action_option.value = 'action|' + action_opt_str + '|' + data.rule_number;
        if(action_opt_str === data.action){
          action_option.selected = true;
        }
        action.add(action_option);
      }
      this.appendChild(action);

      this.appendChild(document.createElement('br'));
    }
  }
});

xtag.register('ha-label-chooser', {
  lifecycle:{
    inserted: function(){
      this.populate();
    }
  },
  methods: {
    populate: function(destination_port_name, destination_object_name){
      if(!destination_object_name){
        // Search upwards through parent HTML components looking for the flow_object to get the destination_object_name from.
        var _parent = this.parentElement;
        while(_parent){
          _parent = _parent.parentElement;
          if(_parent.flow_object){
            //flow_object = _parent.flow_object;
            break;
          }
        }
        var flow_object = _parent.flow_object;
        destination_object_name = flow_object.data.unique_id;
      }

      // Find all flow_objects that link to this one.
      var sources = {};
      var links = getLinks({destination_object: destination_object_name, destination_port: destination_port_name});
      for(var i = 0; i < links.length; i++){
        sources[links[i].data.source_object] = links[i].data.source_port;
      }

      // Search all debug data for entries that come from a port linking to the flow_object and build a list of labels in that data.
      var all_labels = {};
      var label;
      for(var thread in Data.mqtt_data.debug){
        for(var topic in Data.mqtt_data.debug[thread]){
          var debug_source_uid = topic.split('/')[0];
          var debug_source_port = topic.split('/')[2];
          if(sources[debug_source_uid] === debug_source_port){
            for(label in Data.mqtt_data.debug[thread][topic]){
              if(label.substring(0,2) !== '__'){
                all_labels[label] = true;
              }
            }
          }
        }
      }

			this.innerHTML = '';

      var input = document.createElement('input');
      input.setAttribute('list', 'label');
      input.setAttribute('name', 'label');
      //input.setAttribute('value', data.value);
      this.appendChild(input);

      var label_name = document.createElement('DATALIST');
      label_name.id = 'label';
      var output;
      for(label in all_labels){
        output = document.createElement("OPTION");
        //output.text = index;
        output.setAttribute('value', label);
        label_name.appendChild(output);
      }
      this.appendChild(label_name);
    }
  }
});

})();
