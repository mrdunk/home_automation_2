#!/usr/bin/lua

--[[ Allows control of power outlets. ]]--

local CONFIG_FILE =  "/etc/homeautomation/client_devices.conf"

local outlets = {}

function outlets:new(o)
  print("outlets.new()")

  o = o or {}
  setmetatable(o, self)
  self.__index = self

  if info.io == nil then
    info.io = {}
  end
  if info.io.lighting == nil then
    info.io.lighting = {}
  end

  -- Keep a copy of everything entered into info.io by this class so future iterations know what they should be updating.
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

function outlets:read_config()
  if not is_file_or_dir(CONFIG_FILE) then
    if info.io.lighting.ERROR == nil then
      print(CONFIG_FILE .. " does not exist. No client configuration.")
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

  print("Reading: " .. CONFIG_FILE)

  local file_handle = io.open(CONFIG_FILE, "r")
  if file_handle then

    -- Mark all nodes with a role in self.valid_io as potentially_invalid so they will get deleted later if not updated.
    for role in next, info.io do
      for address in next, info.io[role] do
        if self:_is_local(role, address) then
          info.io[role][address].potentially_invalid = true
        end
      end
    end

    info.io.lighting.file_update_time = file_mod_time_string

    local key, value, address, role, command

    for line in file_handle:lines() do
      key, value = string.match(line, "^%s*client\.device\.(.+)%s*:%s*(.+)%s*$")
      if key == "address" and address == nil then
        address = sanitize_topic(value)
      elseif key == "role" and role == nil then
        role = sanitize_topic_atom(value)
      elseif key == "command" and command == nil then
        command = sanitize_filename(value)
      elseif key == nil then
        -- pass
      else
        print("Error in " .. client_config .. " at \"" .. key .. " : " .. value .. "\"")
        file_handle:close()
        return
      end

      if address and role and command then
        --print("Storing: ", address, role, command)
        if info.io[role] == nil then
          info.io[role] = {}
        end
        info.io[role][address] = {command = command, potentially_invalid = nil}
        
        if self.io_local_copy[role] == nil then
          self.io_local_copy[role] = {}
        end
        self.io_local_copy[role][address] = true
        
        address = nil
        role = nil
        command = nil
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

function outlets:announce()
  for address, device in pairs(info.io.lighting) do
    if type(device) == 'table' then
      device_announce("lighting", address, device.command)
    end
  end
end

function outlets:callback(path, incoming_data)
  path = var_to_path(path)
  local incoming_command = incoming_data.command
  local role, address = path:match('(.-)/(.+)')
  if self.io_local_copy[role] and self.io_local_copy[role][address] then
    local command = info.io[role][address].command
    
    if incoming_command == "on" then
      device_set_on(role, address, command)
    elseif incoming_command == "off" then
      device_set_off(role, address, command)
    elseif incoming_command == "solicit" then
      device_announce(role, address, command)
    end

  end
end


return outlets
