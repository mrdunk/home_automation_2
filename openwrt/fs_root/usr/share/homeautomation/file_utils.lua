#!/usr/bin/lua


-- Test if a path exists on the file system.
function is_file_or_dir(fn)
    return os.rename(fn, fn)
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

function sanitize_text(text)
end

function sanitize_fliename(filename)
end

function sanitize_mac_address(mac)
end

function sanitize_url(url)
end
