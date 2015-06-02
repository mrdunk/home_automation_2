#!/usr/bin/lua

--[[ Set IO pins on, off or to various PWM values.
     Requires the gpio-pwm kernel module that is part of this project. ]]--


local homeautomation_gpio = {} 


-- Tests whether the file can be opened for reading.
local function file_exists(name)
   local f=io.open(name,"r")
   if f~=nil then
     io.close(f)
     return true
   else 
     return false
   end
end


-- Set PWM of a single GPIO pin.                                                                 
-- Args:                                                                                   
--  io: pin values. eg: "18".                                    
--  value: Hex value. eg: "c0"
local function ControlPWM(io_pin, value)
  local filename_io = "/sys/class/sw_pwm/pwm_" .. io_pin
  local filename_register = "/sys/class/sw_pwm/register_gpio"

  --print("ControlPWM", io_pin, value)

  value = tonumber(value, 16)

  if file_exists(filename_register) == false then
    print("gpio-pwm.ko kernel module not loaded.")
    os.exit()
  end

  if file_exists(filename_io) == false then
    print("Registering GPIO " .. io_pin .. " for SW PWM.")
    print(filename_register, "w")
    local f = assert(io.open(filename_register, "w"))
    f:write(io_pin)
    f:close()
  end

  if file_exists(filename_io) then
    print("Setting SW PWM on GPIO " .. io_pin .. " to " .. value)
    local f = assert(io.open(filename_io, "w"))
    f:write(value)
    f:close()
  end

end


-- Set PWM of 3 GPIO pins.
-- Args:
--  io: 3 comma seperated pin values. eg: "21, 22, 18".
--  value: Color string. eg: "#aa34c0" or "#4a0"
local function ControlRGB(io_pins, value)
  --print("ControlRGB", io_pins, value)
  local red_io
  local green_io
  local blue_io
  red_io, green_io, blue_io = string.match(io_pins, "^%s*(%d+)%s*,%s*(%d+)%s*,%s*(%d+)%s*$")

  local red_value
  local green_value
  local blue_value
  value = string.match(value, "^(#%x+)$")
  if value == nil then
    return
  elseif string.len(value) == 7 then
    red_value, green_value, blue_value = string.match(value, "^#(%w%w)(%w%w)(%w%w)$")
  elseif string.len(value) == 4 then
    red_value, green_value, blue_value = string.match(value, "^#(%w)(%w)(%w)$")
    red_value = red_value .. "0"
    green_value = green_value .. "0"
    blue_value = blue_value .. "0"
  else
    return
  end

  ControlPWM(red_io, red_value)
  ControlPWM(green_io, green_value)
  ControlPWM(blue_io, blue_value)  
end

local function ControlOnoff(io_pin, value)
  --print("ControlOnoff", io_pin, value)
  value = string.match(value, "^(#%x+)$")
  if value == nil then
    return
  elseif string.len(value) == 7 then
    red_value, green_value, blue_value = string.match(value, "^#(%w%w)(%w%w)(%w%w)$")
  elseif string.len(value) == 4 then
    red_value, green_value, blue_value = string.match(value, "^#(%w)(%w)(%w)$")
    red_value = red_value .. "0"
    green_value = green_value .. "0"
    blue_value = blue_value .. "0"
  else
    return
  end
  value = tonumber(red_value, 16) + tonumber(green_value, 16) + tonumber(blue_value, 16)

  if file_exists(io_pin) then
    print("Switching " .. io_pin .. " to " .. value)
    local f = assert(io.open(io_pin, "w"))
    f:write(value)
    f:close()
  end

end

function homeautomation_gpio.set(io_type, pin, payload) 
  if io_type == "rgb" then
    ControlRGB(pin, payload)
  elseif io_type == "onoff" then
    ControlOnoff(pin, payload)
  elseif io_type == "pwm" then
    ControlPWM(pin, payload)
  elseif io_type == "test" then
    print("test", pin, payload)
  end
end

return homeautomation_gpio
