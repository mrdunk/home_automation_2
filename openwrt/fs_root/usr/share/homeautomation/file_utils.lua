#!/usr/bin/lua


-- Test if a path exists on the file system.
function is_file_or_dir(fn)
    return os.rename(fn, fn)
end

function if_path_alowed(path)
  local split_file_path = split(path, '/')
  local split_CONFIG_DIR = split(CONFIG_DIR, '/')
  local split_TEMP_DIR = split(TEMP_DIR, '/')

  if(#split_file_path < 2) then
    log('if_path_allowed: ', path, ' has less than 2 sections.')
    return
  end

  if(array_starts_with(split_file_path, split_CONFIG_DIR) == nil and array_starts_with(split_file_path, split_TEMP_DIR) == nil) then
    log('if_path_allowed: ', json.encode(split_file_path), ' does not start with either ', json.encode(split_CONFIG_DIR), ' or ', json.encode(split_TEMP_DIR))
    return
  end

  for i, segment in ipairs(split_file_path) do
    if sanitize_filename(segment) == '' then
      log('if_path_allowed: section ', segment, ' in ', path, ' has illegal format.')
      return
    end
  end

  return path
end

function mkdir(dir)
  return os.execute("mkdir -p " .. dir)
end

-- Move a file or directory.
function mv(source, dest)
  return os.rename(source, dest)
end

-- Test if a path exists on the file system. Wild cards can be used.
function match_file_or_dir(fn)
  return os.execute("[ -e  " .. fn .. " ]")
end

function is_file(path)
  if is_file_or_dir(path) == nil then
    return
  end

  local f = io.open(path, "r")
  local ok, err, code = f:read(1)
  f:close()
  return code == nil
end

-- Return hostname of the host running this code.
function hostname()
  local handle = io.popen("uname -snr")
  local uname = handle:read("*line")
  handle:close()
  return string.match(uname, "[%w]+[%s]([%w%p]+)[%s][%w%p]+")
end

-- Return last modification time of a file
function file_mod_time(filename)
  local handle = io.popen("date -r " .. filename)
  if handle then
    local output = handle:read("*line")
    handle:close()
    return output
  end
  return
end

function sanitize_object_name(name)
  name = name:gsub('%s+', '_')
  name = name:gsub('[^_%w]', '')
  if name:gsub('[_]','') == '' then
    return ''
  end
  return name
end

function sanitize_text(text)
  return text:gsub('[^%.%-_%w%s:]','')
end

function sanitize_filename(filename)
  if filename:gsub('[%._%w]','') == '' then
    return filename
  end
  return ''
end

function sanitize_mac_address(mac)
  mac = mac:match('(%x%x:%x%x:%x%x:%x%x:%x%x:%x%x)')
  return mac:gsub(':', '_')
end

function sanitize_url(url)
  -- TODO
  return url
end

function sanitize_digits(digits)
  if digits:gsub('%d', '') == '' then
    return digits
  end
  return ''
end

function sanitize_network_address(address)
  -- IPv4
  if address:match('(%d+%.%d+%.%d+%.%d+)') ~= '' then
    return address
  end

  -- IPv6
  if address:gsub('[%x:]' , '') == '' then
    return address
  end
  return ''
end

function sanitize_topic(topic)
  if topic:gsub('[%w%-_/]' , '') == '' then
    return topic
  end
  return ''
end

function sanitize_topic_with_wild(topic)
  if topic:gsub('[%w%-_/#%+]' , '') == '' then
    return topic
  end
  return ''
end

function sanitize_topic_atom(topic)
  if topic:gsub('[%w%-_]' , '') == '' then
    return topic
  end
  return ''
end

function split(path, deliminator)
  local return_list={} ; i=1
  for str in path:gmatch("([^" .. deliminator .. "]+)") do
    return_list[i] = str
    i = i + 1
  end
  return return_list
end

function path_to_var(path)
	if path == nul then
		return ''
	end
  return path:gsub('/', '__')
end

function var_to_path(var)
  return var:gsub('__', '/')
end

function is_mac_address(mac)
  return mac:match('(%x%x:%x%x:%x%x:%x%x:%x%x:%x%x)')
end

function is_sanitized_mac_address(mac)
  return mac:match('(%x%x_%x%x_%x%x_%x%x_%x%x_%x%x)')
end


-- Serialise object
function dir(obj,level)
  local s,t = '', type(obj)

  level = level or ' '

  if (t=='nil') or (t=='boolean') or (t=='number') or (t=='string') then
    s = tostring(obj)
    if t=='string' then
      s = '"' .. s .. '"'
    end
  elseif t=='function' then s='function'
  elseif t=='userdata' then
    s='userdata'
    for n,v in pairs(getmetatable(obj)) do  s = s .. " (" .. n .. "," .. dir(v) .. ")" end
  elseif t=='thread' then s='thread'
  elseif t=='table' then
    s = '{'
    for k,v in pairs(obj) do
      local k_str = tostring(k)
      if type(k)=='string' then
        k_str = '["' .. k_str .. '"]'
      end
      s = s .. k_str .. ' = ' .. dir(v,level .. level) .. ', '
    end
    s = string.sub(s, 1, -3)
    s = s .. '}'
  end
  return s
end

function array_starts_with(array_full, array_start)
  if #array_full < #array_start then
    return
  end

  for i=1, #array_start do
    if array_full[i] ~= array_start[i] then
      return
    end
  end
  
  return array_start
end
