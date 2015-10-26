
var objectTypes = {'alarm':          {'color':'blue', 'action':'new', callback: FlowObjectTimer},
                   'cloud-download': {'color':'red', 'action':'new', callback: FlowObjectMqttSubscribe},
                   'content-copy':   {'color':'green', 'action':'new'},
                   'redo':           {'action':'join'},
                   'settings':       {'action':'edit'}
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

        console.log(select.options);
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

