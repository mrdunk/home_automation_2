function save(label) {
  console.log('save', label);
  var target = label.split('_')[0];
  if(target === 'device'){
    var device = label.split('_')[1];
    var topic = document.getElementsByClassName(label + '_topic')[0].value;
    var topics = topic.split('/');
    var iotype = document.getElementsByClassName(label + '_iotype')[0].value;
    var io_pin = document.getElementsByClassName(label + '_io_pin')[0].value;
    var io_default = document.getElementsByClassName(label + '_io_default')[0].value;
    var inverted = document.getElementsByClassName(label + '_inverted')[0].checked;
    var url = 'http://' + window.location.host + '/set/?device=' + device;
    url += '&iotype=' + iotype;
    url += '&io_pin=' + io_pin;
    url += '&io_default=' + io_default;
    url += '&inverted=' + inverted;
    for(var i = 0; i < topics.length; i++){
      url += '&address_segment=' + encodeURIComponent(topics[i]);
    }
    send(url);
  } else if(target === 'hostname' || target === 'publishprefix' ||
            target === 'subscribeprefix' || target === 'firmwarehost' ||
            target === 'firmwaredirectory' || target === 'firmwareport' ||
            target === 'enablepassphrase' || target === 'enableiopin' ||
            target === 'ip' || target === 'subnet' || target === 'gateway' ||
            target === 'brokerip' || target === 'brokerport'){
    var data = document.getElementsByClassName(target)[0].value;
    console.log(target);
    var url = 'http://' + window.location.host + '/set/?' + target + '=';
    url += encodeURIComponent(data);
    send(url);
  } else {
    console.log(label, target);
  }
};
function send(url) {
    var xmlHttp = new XMLHttpRequest();
    xmlHttp.onreadystatechange = function() {
       if (xmlHttp.readyState == 4 && xmlHttp.status == 200){
         console.log('Successful GET');
         location.reload();
       }
    }
    xmlHttp.open("GET", url);
    xmlHttp.send();
};
function del(label) {
  console.log('delete', label);
  var target = label.split('_')[0];
  if(target === 'device'){
    document.getElementsByClassName(label + '_topic')[0].value = '';
    save(label);
  }
};

