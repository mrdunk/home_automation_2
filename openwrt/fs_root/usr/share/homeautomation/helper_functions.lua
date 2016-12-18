#!/usr/bin/lua

function get_path(object, path)
  if type(object) ~= 'table' then
    return
  end
  for token in string.gmatch(path, "([%w_]+)") do
    object = object[token]
    if(object == nil) then
      return
     end
  end
  return object
end

--[[ Add recursive table elements to an object.
     Args:
        base_object: the object to be modified.
        path: A "." separated string of the fields to be added.
  ]]--
function populate_object(base_object, path)
  for token in string.gmatch(path, "([%w_]+)") do
    if base_object[token] == nil then
      base_object[token] = {}
    end
    base_object = base_object[token]
  end
end

function log(...)
  local arg = {...}
  if DEBUG and arg then
    local result = ''
    for i,v in ipairs(arg) do
      result = result .. tostring(v) .. "\t"
    end
    print(result)
  end
end

function TableConcat(t1,t2)
  if t1 == nil then
    t1 = {}
  end
  if t2 == nil then
    return t1
  end

  for i=1, #t2 do
    t1[#t1 +1] = t2[i]
  end
  return t1
end

function deepcopy(orig)
    local orig_type = type(orig)
    local copy
    if orig_type == 'table' then
        copy = {}
        for orig_key, orig_value in next, orig, nil do
            copy[deepcopy(orig_key)] = deepcopy(orig_value)
        end
        setmetatable(copy, deepcopy(getmetatable(orig)))
    else -- number, string, boolean, etc
        copy = orig
    end
    return copy
end

