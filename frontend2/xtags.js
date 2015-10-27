
var objectTypes = {'alarm':              {'color':'blue', 'action':'new', callback: FlowObjectTimer},
                   'cloud-download':     {'color':'red', 'action':'new', callback: FlowObjectMqttSubscribe},
                   'cloud-upload':       {'color':'red', 'action':'new', callback: FlowObjectMqttPublish},
                   'add-circle-outline': {'color':'red', 'action':'new', callback: FlowObjectAnd},
                   'trending-flat':      {'color':'red', 'action':'new', callback: FlowObjectMapValues},
                   'content-copy':       {'color':'green', 'action':'new'},
                   'redo':               {'action':'join'},
                   'settings':           {'action':'edit'}
                  }

xtag.register('ha-control', {
  lifecycle:{
    created: function(){
      var template = document.getElementById('ha-control').innerHTML;
      xtag.innerHTML(this, template);
      this.paper = Raphael('ha-control-paper', '100%', '100%');
      this.sidebar = document.getElementById('ha-control-sidebar');
      this.shapes = [];
      this.shareBetweenShapes = {unique_id: 0};
    }
  },
  events: {
    'click:delegate(paper-icon-button)': function(mouseEvent){
      console.log(mouseEvent, this.icon)
      if(objectTypes[this.icon]){
        var ha_control;
        for (var i = 0; i < mouseEvent.path.length; i++){
          if(xtag.matchSelector(mouseEvent.path[i], 'ha-control')){
            ha_control = mouseEvent.path[i]
            break;
          }
        }
        if(ha_control === 'undefined'){ return; }

        var color = objectTypes[this.icon].color;
        var action = objectTypes[this.icon].action;
        if(color){
          ha_control.addShape(objectTypes[this.icon]);
        } else if(action === 'join'){
          console.log('join')
          if(this.hasAttribute('active')){
            ha_control.disableMenuAdd(true);
          } else {
            ha_control.disableMenuAdd(false);
          }
          
          // TESTING
          //ha_control.shapes[ha_control.shapes.length -1].replaceShape(ha_control.paper.box(0,0,50,50,3,2,'yellow'));
        } else if(action === 'edit'){
          console.log('edit')
          if(this.hasAttribute('active')){
            ha_control.disableMenuAdd(true);
          } else {
            ha_control.disableMenuAdd(false);
          }
        }
      }
    },
  },
  methods: {
    addShape: function(object_type){
      var shape;
      console.log(object_type);
      if(object_type.callback){
        shape = new object_type.callback(this.paper, this.sidebar, this.shareBetweenShapes);
      } else {
        shape = new FlowObject(this.paper, this.sidebar, this.shareBetweenShapes, this.paper.box(0, 0, 50, 50, 2, 3, object_type.color));
      }
      shape.setBoxPosition(100,100);

      //shape.displaySideBar();
      shape.select();
      this.shapes.push(shape);
    },
    disableMenuAdd: function(state){
      console.log('disableMenuAdd(', state, ')');
      var buttons = xtag.queryChildren(xtag.queryChildren(this, 'div#ha-control-heading')[0], 'paper-icon-button');
      for(var i = 0; i < buttons.length; i++){
        if(objectTypes[buttons[i].icon].action === 'new'){
          if(state){
            buttons[i].setAttribute('disabled', state);
          } else {
             buttons[i].removeAttribute('disabled');
          }
        }
      }
    }
  }
});


xtag.register('ha-input-attribute', {
  lifecycle:{
    created: function(){
      var template = document.getElementById('ha-input-attribute').innerHTML;
      xtag.innerHTML(this, template);
    },
    removed: function(){
      document.removeEventListener('click', this.clickOutside, false);
    }
  },
  events: {
    click: function(mouseEvent){
      console.log(this, mouseEvent, mouseEvent.target.className);
      if(mouseEvent.target.className === 'summary'){
        mouseEvent.path[1].getElementsByClassName('summary')[0].style.display = 'none';
        mouseEvent.path[1].getElementsByClassName('detailed')[0].style.display = 'inline';
        document.addEventListener('click', this.clickOutside, false);
      }
    }
  },
  methods: {
    populate: function(data){
      console.log(this, data);
      this.getElementsByClassName('description')[0].innerHTML = data.description;

      var form = this.getElementsByClassName('form')[0];

      var inputs = [[true, ['', '==', '!='], '=='],
                    [false, ['', '==', '!='], ''],
                    ['yes', ['', '==', '!='], '=='],
                    ['no', ['', '==', '!='], ''],
                    [0,  ['', '==', '!=', '>', '<', '>=', '<='], ''],
                    [1, ['', '==', '!=', '>', '<', '>=', '<='], '>=']];
      var summary = document.createElement('div');
      summary.className = 'summary';
      var detailed = document.createElement('div');
      detailed.className = 'detailed';
      detailed.style.display = 'none';
      form.appendChild(summary);
      form.appendChild(detailed);

      for(var i = 0; i < inputs.length; i++){
        var wrapper_detailed = document.createElement('div');
        var select = document.createElement('select');
        for(var j = 0; j < inputs[i][1].length; j++){
          var option = document.createElement("option");
          option.text = inputs[i][1][j];
          if(inputs[i][1][j] === inputs[i][2]){
            option.setAttribute("selected", "selected");
          }
          select.appendChild(option);
        }
        if(inputs[i][2] !== ''){
          summary.innerHTML = summary.innerHTML + inputs[i][2] + ' ' + inputs[i][0] + ', ';
        }
        
        select.type = 'checkbox';
        select.name = inputs[i][0];
        wrapper_detailed.appendChild(select);
        wrapper_detailed.innerHTML = wrapper_detailed.innerHTML + inputs[i][0] + '\t(' + typeof(inputs[i][0]) + ')';

        detailed.appendChild(wrapper_detailed);
      }
      summary.innerHTML = summary.innerHTML.substring(0, summary.innerHTML.length -2);
    },
    clickOutside: function(event){
      console.log('clickOutside');
      var form_found;
      for(var parent in event.path){
        if(event.path[parent].className === 'form'){
          form_found = true;
        }
      }
      if(form_found){
        // not actually outside the form.
        return
      }
      console.log('clickOutside 2');

      var summaries = this.getElementsByClassName('summary');
      for(var i = 0; i < summaries.length; i++){
        summaries[i].style.display = "inline";
      }
      var detaileds = this.getElementsByClassName('detailed');
      for(var i = 0; i < detaileds.length; i++){
        detaileds[i].style.display = "none";
      }

      // TODO. the following doesn't work as we no longer have the correct context.
      // document.removeEventListener('click', this.clickOutside, false);  
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
    populate: function(name, data){
      console.log(this, data);
      if(name === 'transitions'){
        var input = document.createElement('ha-transitions');
        input.populate(data);

        this.getElementsByClassName('form')[0].appendChild(input);
      } else if(data.description && data.value){
        this.getElementsByClassName('description')[0].innerHTML = data.description;

        var input = document.createElement("input");
        input.value = data.value;
        input.name = name;
        input.onchange = this.update_callback.bind({element: input, data: data});

        this.getElementsByClassName('form')[0].appendChild(input);
      }
    },
    update_callback: function(){
      console.log('update_callback', this);
      this.data.value = this.element.value;
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
  methods: {
    populate: function(data){
      console.log(this, data);
      this.data = data;

      if(data.value.length === 0){
        this.new__range();
      }

      var form = this.getElementsByClassName('transition-form')[0];
      for(var i = 0; i < data.value.length; i++){
        form.appendChild(this.chooser_pair(data.value[i]));
      }
    },
    update_callback: function(){
      console.log('update_callback', this);
    },
    new__range: function(){
      var range = {input: true, output: true};
      this.data.value.push(range);
    },
    chooser_pair: function(range){
      var container = document.createElement('div');
      container.appendChild(this.chooser(range, 'input'));
      container.appendChild(this.chooser(range, 'output'));
      return container;
    },
    chooser: function(range, io){
      var container = document.createElement('div');
      var select = document.createElement('select');
      var option = document.createElement("option");
      option.text = 'boolean';
      if(typeof(range[io]) === 'boolean'){
        option.setAttribute("selected", "selected");
      }
      select.appendChild(option);
      option = document.createElement("option");
      option.text = 'string';
      if(typeof(range[io]) === 'string'){
        option.setAttribute("selected", "selected");
      }
      select.appendChild(option);
      option = document.createElement("option");
      option.text = 'number';
      if(typeof(range[io]) === 'object'){
        option.setAttribute("selected", "selected");
      }
      select.appendChild(option);

      var input_bool = document.createElement('select');
      option = document.createElement("option");
      option.text = 'true';
      option.value = true;
      if(typeof(range[io]) === 'boolean'){
        if(range[io]){
          option.setAttribute("selected", "selected");
        }
      }
      input_bool.appendChild(option);
      option = document.createElement("option");
      option.text = 'false';
      option.value = false;
      if(typeof(range[io]) === 'boolean'){
        if(range[io] === false){
          option.setAttribute("selected", "selected");
        }
      }
      input_bool.appendChild(option);

      var input_string = document.createElement('input');
      input_string.type = 'text';
      input_string.value = range[io];

      var input_number = document.createElement('div');
      var input_number_low = document.createElement('input');
      input_number_low.type = 'number';
      if(range[io].low){
        input_number_low.value = range[io].low;
      } else {
        input_number_low.value = 0;
      }
      input_number_low.style.width = '4em';
      var input_number_high = document.createElement('input');
      input_number_high.type = 'number';
      if(range[io].high){
        input_number_high.value = range[io].high;
      } else {
        input_number_high.value = 100;
      }
      input_number_high.style.width = '4em';
      input_number.appendChild(input_number_low);
      input_number.appendChild(input_number_high);

      if(select.value !== 'boolean'){
        input_bool.style.display = "none";
      }
      if(select.value !== 'string'){
        input_string.style.display = "none";
      }
      if(select.value !== 'number'){
        input_number.style.display = "none";
      }

      container.appendChild(select);
      container.appendChild(input_bool);
      container.appendChild(input_string);
      container.appendChild(input_number);

      container.addEventListener('change', this.chooser_change.bind({
          data: range, io: io, select: select, input_bool: input_bool, input_string: input_string, input_number: input_number}));
      container.addEventListener('mousedown', this.chooser_change.bind({
          data: range, io: io, select: select, input_bool: input_bool, input_string: input_string, input_number: input_number}));
      return container;
    },
    chooser_change: function(){
      console.log('chooser_change', this);

      // TODO: fix this so it only allows number ranges for the output if there are number ranges for the input.
      if(this.io === 'output'){
        if(typeof(this.data.input) !== 'object'){
          if(this.select.value === 'number'){
            this.select.children[2].removeAttribute("selected");
            this.select.children[1].setAttribute("selected", "selected");
          }
          this.select.children[2].style.display = "none";
        } else{
          this.select.children[2].style.display = "initial";
        }
      }

      if(this.select.value === 'boolean'){
        this.input_bool.style.display = 'inline';
        this.input_string.style.display = 'none';
        this.input_number.style.display = 'none';
        this.data[this.io] = this.input_bool.value == 'true';
      } else if(this.select.value === 'string'){
        this.input_bool.style.display = 'none';
        this.input_string.style.display = 'inline';
        this.input_number.style.display = 'none';
        this.data[this.io] = this.input_string.value;
      } else if(this.select.value === 'number'){
        this.input_bool.style.display = 'none';
        this.input_string.style.display = 'none';
        this.input_number.style.display = 'inline';
        this.data[this.io] = {low: this.input_number.children[0].value, high: this.input_number.children[1].value};
      }

      if(this.input_number.children[0].value > this.input_number.children[1].value){
        this.input_number.children[1].value = this.input_number.children[0].value;
      }

      console.log(this.data);
    }
  }
});
