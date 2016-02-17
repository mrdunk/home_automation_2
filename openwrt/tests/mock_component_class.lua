#!/usr/bin/lua

component = {}

function component:new(o)
  o = o or {}

  setmetatable(o, self)
  self.__index = self

  o.object_type = 'mock_component'
  if o.unique_id then
	  info.components[o.unique_id] = o
  end

  if o.last_received == nil then
    o.last_received = {}
  end

  return o
end

function component:receive_input(data, port_label, from_unique_id, from_port_label)
  log('component:receive_input(', json.encode(data), port_label, from_unique_id, from_port_label, ')')
	self.last_received = data
end

function component:make_data_copy(data, port_label, from_unique_id, from_port_label)
	return deepcopy(data)
end

function component:get_general(label)
  return self.unique_id
end

return component

