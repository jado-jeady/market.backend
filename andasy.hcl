# andasy.hcl app configuration file generated for marketpos on Wednesday, 11-Mar-26 16:50:42 SAST
#
# See https://github.com/quarksgroup/andasy-cli for information about how to use this file.

app_name = "marketpos"

app {
  port = 8080
  primary_region = "kgl" 


  compute {
    cpu      = 1
    memory   = 512  # Increased to 512 to avoid OOM during build
    cpu_kind = "shared"
  }
  process{
    name="marketpos"
  }
}
