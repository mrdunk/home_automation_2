#!/usr/bin/lua

--[[ ]]--

local CONFIG_FILE =  "/etc/homeautomation/client_devices.conf"

local outlets = {test = 0}
outlets.__index = outlets


function outlets.new()
  print("outlets.new()")

  local self = setmetatable({}, outlets)

  if info.io == nil then
    info.io = {}
  end
  if info.io.lighting == nil then
    info.io.lighting = {}
  end

  info.mqtt.subscription_loaders['outlets'] = self.subscribe
  info.mqtt.announcer_loaders['outlets'] = self.announce

  -- Keep a copy of everything entered into info.io by this class so future iterations know what they should be updating.
  self.io_local_copy = {}

  return self
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
        address = value
      elseif key == "role" and role == nil then
        role = value
      elseif key == "command" and command == nil then
        command = value
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

function outlets:subscribe(subscribe_to)
  for address, device in pairs(info.io.lighting) do
    if type(device) == 'table' then
      local subscription = ""
      for address_section in string.gmatch(address, "[^/]+") do
        subscribe_to["homeautomation/+/lighting" .. subscription .. "/all"] = true
        subscribe_to["homeautomation/+/all" .. subscription .. "/all"] = true

        subscription = subscription .. "/" .. address_section
      end
      subscribe_to["homeautomation/+/lighting" .. subscription] = true
      subscribe_to["homeautomation/+/all" .. subscription] = true
    end
  end

  return subscribe_to
end

function outlets:announce()
  for address, device in pairs(info.io.lighting) do
    if type(device) == 'table' then
      device_announce("lighting", address, device.command)
    end
  end
end


return outlets
