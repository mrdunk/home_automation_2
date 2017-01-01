#!/usr/bin/lua

--[[ Allows control of power outlets. ]]--

local CONFIG_FILE =  "/etc/homeautomation/client_devices.conf"

local outlets = {}

function outlets:new(o)
  log("outlets.new()")

  o = o or {}
  setmetatable(o, self)
  self.__index = self

  if info.io == nil then
    info.io = {}
  end
  if info.io.lighting == nil then
    info.io.lighting = {}
  end

  -- Keep a copy of everything entered into info.io by this class so future iterations
  -- know what they should be updating.
  self.io_local_copy = {}

  return o
end

-- Test if an outlet has been previously assigned by this class.
function outlets:_is_local(role, address)
  for role_local in next, self.io_local_copy do
    if role == role_local then
      for address_local in next, self.io_local_copy[role_local] do
        if address == address_local then
          return true
        end
      end
    end
  end
end

-- Called periodically.
function outlets:update()
  self:read_config()
  self:delayed_actions()
end

function outlets:delayed_actions()
  for role in next, info.io do
    for address in next, info.io[role] do
      if info.io[role][address].command ~= nil and
           info.io[role][address].timer_trigger ~= nil and
           info.io[role][address].timer_action ~= nil and
           info.io[role][address].timer_duration ~= nil and
           tonumber(info.io[role][address].timer_countdown) > 0 then
        info.io[role][address].timer_countdown = tonumber(info.io[role][address].timer_countdown) - tonumber(info.config.update_delay)
        if info.io[role][address].timer_countdown <= 0 then
          log('Auto switch off after timeout:', role, address)
          info.io[role][address].timer_countdown  = 0
          self:operate_one(role, address, info.io[role][address].timer_action)
        end
      end
    end
  end
end

function outlets:read_config()
  if not is_file_or_dir(CONFIG_FILE) then
    if info.io.lighting.ERROR == nil then
      log(CONFIG_FILE .. " does not exist. No client configuration.")
    end
    info.io.lighting.ERROR = CONFIG_FILE .. " does not exist. No client configuration."
    return
  end
  info.io.lighting.ERROR = nil

  -- Only need to read if file has been modified since last read.
  local file_mod_time_string = file_mod_time(CONFIG_FILE)
  if file_mod_time_string == info.io.lighting.file_update_time then
    return
  end

  log("Reading: " .. CONFIG_FILE)
  local file_handle = io.open(CONFIG_FILE, "r")
  if file_handle then

    -- Mark all nodes with a role in self.valid_io as potentially_invalid so they will
    -- get deleted later if not updated.
    for role in next, info.io do
      for address in next, info.io[role] do
        if self:_is_local(role, address) then
          info.io[role][address].potentially_invalid = true
        end
      end
    end

    info.io.lighting.file_update_time = file_mod_time_string

    local key, value, address, role, command, timer_trigger, timer_duration, timer_action

    for line in file_handle:lines() do
      key, value = string.match(line, "^%s*client\.device\.(.+)%s*:%s*(.+)%s*$")
      if key == "address" and address == nil then
        address = sanitize_topic(value)
      elseif key == "role" and role == nil then
        role = sanitize_topic_atom(value)
      elseif key == "command" and command == nil then
        command = sanitize_filename(value)
      elseif key == "timer_trigger" and timer_trigger == nil then
        timer_trigger = sanitize_text(value)
      elseif key == "timer_duration" and timer_duration == nil then
        timer_duration = sanitize_digits(value)
      elseif key == "timer_action" and timer_action == nil then
        timer_action = sanitize_text(value)
      elseif key == nil then
        -- pass
      else
        log("Error in " .. CONFIG_FILE .. " at \"" .. key .. " : " .. value .. "\"")
        file_handle:close()
        return
      end

      if (address ~= nil) and (role ~= nil) and (command ~= nil) and 
          (timer_trigger ~= nil) and (timer_duration ~= nil) and (timer_action ~= nil) then
        log("Storing: ", address, role, command, timer_trigger, timer_duration, timer_action)
        if info.io[role] == nil then
          info.io[role] = {}
        end
                                  -- Set to low value for timer_countdown we get 
                                  -- to 0 soon and
                                  -- transition to timer_action state.
                                  -- THis ensures defined behaviour when daemon 
                                  -- is restarted.
        info.io[role][address] = {command = command,
                                  timer_trigger = timer_trigger,
                                  timer_duration = timer_duration,
                                  timer_action = timer_action,
                                  timer_countdown = 1,
                                  potentially_invalid = nil}
        
        if self.io_local_copy[role] == nil then
          self.io_local_copy[role] = {}
        end
        self.io_local_copy[role][address] = true
        
        address = nil
        role = nil
        command = nil
        timer_trigger = nil
        timer_duration = nil
        timer_action = nil
      end
    end
    file_handle:close()
  end

  -- Clean up any that have expired.
  -- TODO Move this to a cleanup function so it can be shared between all info.io elements. 
  for role in next, info.io do
    for address in next, info.io[role] do
      if info.io[role][address].potentially_invalid then
        info.io[role][address] = nil
        self.io_local_copy[role][address] = nil
      end
    end
  end

  -- Now disconnect from pubsub broker so it will re-connect with the right subscrptions for the new config.
  mqtt_instance:disconnect()
end

-- Called when MQTT connects and returns a list of topics this module should subscribe to.
function outlets:subscribe()
  local subscritions = {}
  for role, things in pairs(self.io_local_copy) do
    if type(things) == 'table' then
      for address, thing in pairs(things) do
        subscritions[#subscritions +1] = {role = role, address = address}
      end
    end
  end
  return subscritions
end

-- Publishes topics this module knows about. 
function outlets:announce()
  for address, device in pairs(info.io.lighting) do
    if type(device) == 'table' then
      device_announce("lighting", address, device.command)
    end
  end
end

-- This gets called whenever a topic this module is subscribed to appears on the bus.
function outlets:callback(path, incoming_data)
  log("outlets:callback(", path, incoming_data, ")")
  path = var_to_path(path)
  local role, address = path:match('(.-)/(.+)')
  if role == '_all' then
    role = 'lighting'
  end

  -- "address" might contain "_all" keyword rather than full path so we need to compare 
  -- against every known device.
  for light_address, _ in pairs(info.io.lighting) do
    if light_address ~= 'file_update_time' then
      if match_paths(role .. '/' .. address, role .. '/' .. light_address, true) then
        self:operate_one(role, light_address, incoming_data._command)
      end
    end
  end
end

function outlets:operate_one(role, address, command)
  log("   outlets:operate_one(", role, address, incoming_data, ")")
  if self.io_local_copy[role] and self.io_local_copy[role][address] then
    local power_script = info.io[role][address].command
    
    if command == "on" then
      device_set_on(role, address, power_script)
    elseif command == "off" then
      device_set_off(role, address, power_script)
    elseif command == "solicit" then
      device_announce(role, address, power_script)
    end

    -- Set future action if it was configured.
    -- eg. switch a light off again after a delay.
    if info.io[role][address].timer_trigger == command then
      info.io[role][address].timer_countdown = tonumber(info.io[role][address].timer_duration)
    end
  end
end


-- Get the value a particular device is set to. eg. "on" or "off".
-- Works by calling a bash program that contains the necessary code to perform the operation.
-- The name of this bash program can be set in the main configuration file.
function device_get_value(role, address, command)
  -- TODO limit executable code in device.command.query to shell scripts in a limited directory.
  local device_tmp_filename = string.gsub(address, "/", "__")
  local handle = io.popen(POWER_SCRIPT_DIR .. command .. " " .. device_tmp_filename .. " query")
  if not handle then
    return nil
  end
  local ret_val = handle:read("*all")
  handle:close()

  return ret_val:match "^%s*(.-)%s*$"
end

-- Set a power management device to the "on" state.
-- Works by calling a bash program that contains the necessary code to perform the operation.
-- The name of this bash program can be set in the main configuration file.
function device_set_on(role, address, command)
  log("device_set_on: " .. address)
  local device_tmp_filename = string.gsub(address, "/", "__")
  local ret_val = os.execute(POWER_SCRIPT_DIR .. command .. " " .. device_tmp_filename .. " on")
  device_announce(role, address, command)
  return ret_val
end

-- Set a power management device to the "off" state.
-- Works by calling a bash program that contains the necessary code to perform the operation.
-- The name of this bash program can be set in the main configuration file.
function device_set_off(role, address, command)
  log("device_set_off: " .. address)
  local device_tmp_filename = string.gsub(address, "/", "__")
  local ret_val = os.execute(POWER_SCRIPT_DIR .. command .. " " .. device_tmp_filename .. " off")
  device_announce(role, address, command)
  return ret_val
end

-- Advertise the existence of a device over the message bus.
function device_announce(role, address, command)
  local value = device_get_value(role, address, command)
  local topic = "homeautomation/0/" .. role .. "/_announce"
  local data = "_subject : " .. role .. "/" .. address .. " , _state : " .. value
  log("Announcing: " .. topic, data)
  mqtt_instance:publish(topic, data)

  if DEBUG then
    local found_match
    for k, v in pairs(info.mqtt.last_announced) do
      if string.match(info.mqtt.last_announced[k], address .. " : ") then
        found_match = true
        info.mqtt.last_announced[k] = role .. "/" .. address .. " : " .. os.time()
      end
    end
    if not found_match then
      table.insert(info.mqtt.last_announced, role .. "/" .. address .. " : " .. os.time())
    end
  end
end


return outlets
