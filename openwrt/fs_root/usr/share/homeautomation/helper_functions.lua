#!/usr/bin/lua

function get_path(object, path)
  for token in string.gmatch(path, "^(%w+).") do
    object = object[token]
    if(object == nil) then
      return
     end
  end
  return object
end
