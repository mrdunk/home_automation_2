#!/usr/bin/lua


local control = {}
control.__index = control

function control:new()
  local self = {}
  setmetatable(self, control)
  return self
end

function control:update_log(text)
  log('control:update_log(', text, ')')
end

return control

