/*global xtag*/
/*global Raphael*/

/*global Data*/

/*global FlowObjectTimer*/
/*global FlowObjectMqttSubscribe*/
/*global FlowObjectMqttPublish*/
/*global FlowObjectMapValues*/
/*global FlowObjectTestData*/
/*global FlowObjectCombineData*/

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
        button.setContent(flow_object.data.label);
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
    'click:delegate(paper-icon-button)': function(mouseEvent){
      console.log(mouseEvent, this);
    }
  },
  methods: {
    setParent: function(parent){
      console.log(parent);
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
	      var sidebar = mouse_event.target;
  	    var counter = 0; 
    	  while(counter < 10 && sidebar.tagName.toLowerCase() !== 'ha-sidebar'){
      	  counter++;
        	sidebar = sidebar.parentElement;
	      }
  	    if(sidebar === undefined){
    	    return;
      	}

        if(sidebar.align === 'right'){
          this.style.right = (sidebar.getBoundingClientRect().right - mouse_event.clientX - (this.getBoundingClientRect().width /2)) + 'px';
          sidebar.style.width = (sidebar.getBoundingClientRect().right - this.getBoundingClientRect().left -1) + 'px';
        } else {
          this.style.left = (-sidebar.getBoundingClientRect().left + mouse_event.clientX - (this.getBoundingClientRect().width /2) -2) + 'px';
          sidebar.style.width = (-sidebar.getBoundingClientRect().left + this.getBoundingClientRect().right -1) + 'px';
        }
      }
    }
  },
  methods: {
    resize: function(width){
      console.log(width);
      if(this.align === 'right'){
        this.style.width = width + 'px';
        this.handle.style.right = (width - this.handle.getBoundingClientRect().width) + 'px';
      } else {
        this.style.width = width + 'px';
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

xtag.register('ha-flowobject-data', {
  lifecycle:{
    created: function(){
      var template = document.getElementById('ha-flowobject-data').innerHTML;
      xtag.innerHTML(this, template);
    }
  },
  methods: {
    populate: function(data, flow_object){

      var list_content = this.getElementsByClassName('general')[0];
			for(var general_id in data.general){
        var general_attributes = document.createElement(data.general[general_id].updater);
        general_attributes.populate(data.general[general_id], flow_object);
      	list_content.appendChild(general_attributes);
			}

      list_content = this.getElementsByClassName('input')[0];
      for(var input_id in data.inputs){
        var input_attributes = document.createElement('ha-input-attributes');
        input_attributes.populate(data.inputs[input_id], flow_object);
        list_content.appendChild(input_attributes);
      }

      list_content = this.getElementsByClassName('output')[0];
      for(var output_id in data.outputs){
      	var output_attributes = document.createElement('ha-output-attributes');
				output_attributes.populate(data.outputs[output_id], flow_object);
				list_content.appendChild(output_attributes);
      }
    }
  },
});

xtag.register('ha-input-attributes', {
  lifecycle:{
    created: function(){
      var template = document.getElementById('ha-input-attribute').innerHTML;
      xtag.innerHTML(this, template);
    }
  },
  methods: {
    populate: function(data, flow_object){
      //console.log(data);
      this.getElementsByClassName('description')[0].innerHTML = data.description;
      var form = this.getElementsByClassName('form')[0];

      // Modifiable attributes.
      for(var label in data.peramiters){
        var general_attributes = document.createElement(data.peramiters[label].updater);
        general_attributes.populate(data.peramiters[label], flow_object);
        form.appendChild(general_attributes);        
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
    populate: function(data, flow_object){
      this.getElementsByClassName('description')[0].innerHTML = data.description;
      var form = this.getElementsByClassName('form')[0];

      // Modifiable attributes.
      for(var label in data.peramiters){
        var general_attributes = document.createElement(data.peramiters[label].updater);
        general_attributes.populate(data.peramiters[label], flow_object);
        form.appendChild(general_attributes);                
      }
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
      if(data.form_type){
        input = document.createElement(data.form_type);
        input.rows = 4;
        input.cols = 50;
      } else {
        input = document.createElement("input");
      }
			input.value = data.value;
			input.name = name;
			input.onchange = this.update_callback.bind({element: input, data: data, flow_object: flow_object});
			this.getElementsByClassName('form')[0].appendChild(input);
    },
    update_callback: function(update_event){
      console.log('update_callback', this, update_event);

      if(this.data.update_on_change){
        // Some special activity is requested when this field changes.
        if(typeof this.data.update_on_change === 'function'){
          // We have a callback function to deal with this field.
          this.data.update_on_change.call(this.flow_object, this.element.value);
        } else {
          // Just save the data.
          this.data.value = this.element.value;
        }

        // Update the sidebar.
        this.flow_object.displaySideBar();
      } else {
        // No special activity requested when this field changes. Just save the data.
        this.data.value = this.element.value;
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

xtag.register('ha-transitions', {
  lifecycle:{
    created: function(){
      var template = document.getElementById('ha-transitions').innerHTML;
      xtag.innerHTML(this, template);
    },
  },
  events: {
    'click:delegate(button)': function(mouseEvent){
      console.log(mouseEvent.srcElement.value);
      var transition; 
      for (var i = 0; i < mouseEvent.path.length; i++){
        if(xtag.matchSelector(mouseEvent.path[i], 'ha-transitions')){
          transition = mouseEvent.path[i];
          break;
        }
      }
      if(transition === 'undefined'){ return; }

      var button_values = mouseEvent.srcElement.value.split('|');
      if(button_values[0] === 'add'){
        transition.newRange(button_values[1]);
        transition.populate();
      } else {
        transition.data.values[button_values[1]].splice(parseInt(button_values[0]), 1);
        transition.populate();
      }
    },
    change: function(event){
      if(event.target.name.split('|',1)[0] === 'label'){
        this.changeLabel(event.target.name.split('|')[1], event.target.value);
      }
    }
  },
  methods: {
    populate: function(data, flow_object){
      this.data = data || this.data;
      this.flow_object = flow_object || this.flow_object;

			//console.log(this.data);

      if(Object.keys(this.data.values).length === 0){
        this.prePopulateRange();
      }

			this.getElementsByClassName('description')[0].innerHTML = this.data.description;

      var form = this.getElementsByClassName('transition-form')[0];
      while(form.firstChild){
        form.removeChild(form.firstChild);
      }

      for(var label in this.data.values){
        var table = document.createElement('div');
        table.className = 'table-transition';
        form.appendChild(table);
        var header = document.createElement('div');
        var content = document.createElement('div');
        var control = document.createElement('div');
        var left = document.createElement('div');
        var right = document.createElement('div');
        content.className = 'content-transition';
        control.className = 'control-transition';
        left.className = 'input-transition';
        right.className = 'output-transition';
        table.appendChild(header);
        table.appendChild(content);
        content.appendChild(control);
        content.appendChild(left);
        content.appendChild(right);

        var label_tag = document.createElement('div');
        label_tag.innerHTML = 'Label:';
        var datalist = document.createElement('ha-select-label');
				datalist.populate({value: label}, this.flow_object);

        header.appendChild(label_tag);
        header.appendChild(datalist);

        var div;
        var button;
				var i;
        for(i = 0; i < this.data.values[label].length -1; i++){
          // ".length -1" because the last item in the list is a special case which we handle separately.
          div = document.createElement('div');
          button = document.createElement('button');
          button.textContent = '-';
          button.value = i + '|' + label;
          div.appendChild(button);
          control.appendChild(div);
          left.appendChild(this.chooser(this.data.values[label][i], 'input'));
          right.appendChild(this.chooser(this.data.values[label][i], 'output'));
        }
        div = document.createElement('div');
        button = document.createElement('button');
        button.textContent = '+';
        button.value = 'add|' + label;
        div.appendChild(button);
        control.appendChild(div);
				var button_spacer = document.createElement('div');
				button_spacer.className = 'button-spacer';
        left.appendChild(button_spacer);
        right.appendChild(button_spacer.cloneNode(false));

        // Now the last item in the list...
        i = this.data.values[label].length -1;
				control.appendChild(button_spacer.cloneNode(false));
				left.appendChild(this.chooser(this.data.values[label][i], 'input'));
				right.appendChild(this.chooser(this.data.values[label][i], 'output'));
      }
    },
    changeLabel: function(from, to){
      console.log('changeLabel(', from, to, ')');
      if(from === to){
        return;
      }
      if(this.data.values[from] === undefined){
        return;
      }

      this.data.values[to] = this.data.values[from];
      delete this.data.values[from];
 
      this.update_sidebar();
    },
    newRange: function(label){
      var range = {input: true, output: true};
      this.data.values[label].splice(this.data.values[label].length -1, 0, range);
    },
    prePopulateRange: function(){
      this.data.values._subject = [];
      this.data.values._subject.push( {input: 'yes', output: true} );
			this.data.values._subject.push( {input: '_missing', output: false} );
      this.data.values._subject.push( {input: '_else', output: '_drop'} );
    },
    chooser: function(range, io){
      // Create a widget that allows a choice of input or output data. (string, number, boolean, etc.)

      var container = document.createElement('div');

			if(io === 'input' && range[io] === '_else'){
        // This is a special case filter that is always last on the list.
        // It decides what to do if none of the other filters match.
        container.innerHTML = 'If none of the above match:';
        return container;
      }

      var select = document.createElement('select');

			// Add 'boolean' to select.
      var option = document.createElement('option');
      option.text = 'boolean';
      if(typeof(range[io]) === 'boolean'){
        option.setAttribute('selected', 'selected');
      }
      select.appendChild(option);

			// Add 'string' to select.
      option = document.createElement('option');
      option.text = 'string';
      if(typeof(range[io]) === 'string' && (range[io] !== '_forward' || range[io] !== '_drop' || range[io] !== '_missing')){
        option.setAttribute('selected', 'selected');
      }
      select.appendChild(option);

			// Add 'number' to select.
      option = document.createElement('option');
      option.text = 'number';
      if(typeof(range[io]) === 'object'){
        option.setAttribute('selected', 'selected');
      }
      select.appendChild(option);

			if(io === 'input'){
				// Add 'missing' to select.
				option = document.createElement('option');
				option.text = 'missing';
				if(range[io] === '_missing'){
					option.setAttribute('selected', 'selected');
				}
				select.appendChild(option);
			}

			// Add output only options.
      if(io === 'output'){
				option = document.createElement('option');
				option.text = 'forward';
				if(typeof(range[io]) === 'string' && range[io] === '_forward'){
					option.setAttribute('selected', 'selected');
				}
				select.appendChild(option);

				option = document.createElement('option');
				option.text = 'drop';
				if(typeof(range[io]) === 'string' && range[io] === '_drop'){
					option.setAttribute('selected', 'selected');
				}
				select.appendChild(option);
			}


			var input_bool = document.createElement('select');
			option = document.createElement('option');
			option.text = 'true';
			option.value = true;
      if(typeof(range[io]) === 'boolean'){
        if(range[io]){
          option.setAttribute('selected', 'selected');
        }
      }
      input_bool.appendChild(option);
      option = document.createElement('option');
      option.text = 'false';
      option.value = false;
      if(typeof(range[io]) === 'boolean'){
        if(range[io] === false){
          option.setAttribute('selected', 'selected');
        }
      }
      input_bool.appendChild(option);

      var input_string = document.createElement('input');
      input_string.type = 'text';
      input_string.value = range[io];

      var input_number = document.createElement('div');
      var input_number_low = document.createElement('input');
      input_number_low.type = 'number';
      if(typeof range[io].low !== 'undefined'){
        input_number_low.value = range[io].low;
      } else {
        input_number_low.value = 0;
      }
      input_number_low.style.width = '4em';
      var input_number_high = document.createElement('input');
      input_number_high.type = 'number';
      if(typeof range[io].high !== 'undefined'){
        input_number_high.value = range[io].high;
      } else {
        input_number_high.value = 100;
      }
      input_number_high.style.width = '4em';
      input_number.appendChild(input_number_low);
      input_number.appendChild(document.createTextNode('to'));
      input_number.appendChild(input_number_high);

      if(select.value !== 'boolean'){
        input_bool.style.display = 'none';
      }
      if(select.value !== 'string'){
        input_string.style.display = 'none';
      }
      if(select.value !== 'number'){
        input_number.style.display = 'none';
      }

      container.appendChild(select);
      container.appendChild(input_bool);
      container.appendChild(input_string);
      container.appendChild(input_number);

      container.addEventListener('change', this.chooser_change.bind({
          data: range, io: io, select: select, input_bool: input_bool, input_string: input_string, input_number: input_number}));
      container.addEventListener('change', this.update_sidebar.bind({ flow_object: this.flow_object }));
      container.addEventListener('mousedown', this.chooser_change.bind({
          data: range, io: io, select: select, input_bool: input_bool, input_string: input_string, input_number: input_number}));
      return container;
    },
    update_sidebar: function(){
      //this.flow_object.FilterInputToOutput(0);
      this.flow_object.displaySideBar();
    },
    chooser_change: function(){
			// This gets called when widgets on the form get adjusted.

      console.log('chooser_change', this);

      // TODO: fix this so it only allows number ranges for the output if there are number ranges for the input.
      if(this.io === 'output'){
        if(typeof(this.data.input) !== 'object'){
          if(this.select.value === 'number'){
            this.select.children[2].removeAttribute('selected');
            this.select.children[1].setAttribute('selected', 'selected');
          }
          this.select.children[2].style.display = 'none';
        } else{
          this.select.children[2].style.display = 'initial';
        }
      }

      if(this.select.value === 'boolean'){
        this.input_bool.style.display = 'inline';
        this.input_string.style.display = 'none';
        this.input_number.style.display = 'none';
        this.data[this.io] = this.input_bool.value === 'true';
      } else if(this.select.value === 'string'){
        this.input_bool.style.display = 'none';
        this.input_string.style.display = 'inline';
        this.input_number.style.display = 'none';
				// The special cases '_drop' and '_forward' are just strings.
        // If someone actually wants to change from a '_drop' to a 'string' we need to make sure
        // '_drop' is not still in the data field of the widget will think it's actually a drop.
				if(this.input_string.value !== '_drop' && this.input_string.value !== '_forward' && this.input_string.value !== '_missing'){
        	this.data[this.io] = this.input_string.value;
				} else {
					this.data[this.io] = '';
				}
      } else if(this.select.value === 'number'){
        this.input_bool.style.display = 'none';
        this.input_string.style.display = 'none';
        this.input_number.style.display = 'inline';
        this.data[this.io] = {low: this.input_number.children[0].value, high: this.input_number.children[1].value};
      } else if(this.select.value === 'drop'){
        this.input_bool.style.display = 'none';
        this.input_string.style.display = 'none';
        this.input_number.style.display = 'none';
        this.data[this.io] = '_drop';
      } else if(this.select.value === 'forward'){
        this.input_bool.style.display = 'none';
        this.input_string.style.display = 'none';
        this.input_number.style.display = 'none';
        this.data[this.io] = '_forward';
      } else if(this.select.value === 'missing'){
        this.input_bool.style.display = 'none';
        this.input_string.style.display = 'none';
        this.input_number.style.display = 'none';
        this.data[this.io] = '_missing';
      }

      // Make sure left number is lower than the right one.
      if(Number(this.input_number.children[0].value) > Number(this.input_number.children[1].value)){
        this.input_number.children[1].value = this.input_number.children[0].value;
      }
    }
  }
});


xtag.register('ha-topic-chooser', {
  lifecycle:{
    created: function(){
    },
  },
  events: {
    change: function(event){
      console.log('ha-topic-chooser: change', event, event.target.value);
      this.flow_object.data.data.general.subscribed_topic.value = event.target.value;
      
      this.flow_object.setContents();
      this.flow_object.displaySideBar();
      //this.flow_object.setAdjacentInputSamples();
      console.log(this.flow_object.data.data.outputs[0]);
    }
  },
  methods: {
    populate: function(data, flow_object){
      this.flow_object = flow_object;
      var topic_list = [];
      var key;
      for(key in Data.mqtt_data){
        if(typeof(key) === 'string' && key !== 'updated' && typeof(Data.mqtt_data[key]) === 'object'){
          topic_list.push(key);
        }
      }
      topic_list = Data.ExpandTopics(topic_list);

      var input = document.createElement('input');
      input.setAttribute('list', 'topics');
      input.setAttribute('name', 'topics');
      input.setAttribute('value', data.value);
      this.appendChild(input);
      
      var datalist = document.createElement('DATALIST');
      datalist.id = 'topics';
      this.appendChild(datalist);
			var option = document.createElement("OPTION");
			option.setAttribute("value", '');
			datalist.appendChild(option);
      for(key in topic_list){
        option = document.createElement("OPTION");
        option.setAttribute("value", 'homeautomation/+/' + topic_list[key]);
        datalist.appendChild(option);
      }
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
    dragend: function(event){
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

})();
