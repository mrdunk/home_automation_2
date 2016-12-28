const String page(const String&  style, const String& head, const String& body){
  return "<!DOCTYPE html>\n"
         "<html><head><style>" + style + "</style>" +
         head + "</head>" +
         "<body>" + body + "</body>" +
         "</html>";
}

const String descriptionList(const String& items){
  return "<dl>" + items + "</dl>";
}

const String descriptionListItem(const String key, const String value){
  return "<dt>" + key + "</dt><dd>" + value + "</dd>";
}

const String style(){
  return "dl {border: 3px double #ccc;}" 
         "dt {float: left; clear: left; width: 10em; font-weight: bold; background: darkgrey}" 
         "dt:after {content: ':'; }" 
         "dd {margin-bottom: 1px; background: darkgrey}";
}
