terraform {
  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 4.0"
    }
  }
}

variable "cf_api_token" {
  description = "Cloudflare api token"
  type        = string
  sensitive   = true
}

variable "cf_account_id" {
  description = "Cloudflare account id"
  type        = string
}

variable "cf_zone_id" {
  description = "Cloudflare zone id"
  type        = string
}

variable "cf_route" {
  description = "Cloudflare route"
  type        = string
}

variable "slumber_user" {
  description = "Website user"
  type        = string
}

variable "slumber_password" {
  description = "Website password"
  type        = string
}

provider "cloudflare" {
  api_token = var.cf_api_token
}

resource "cloudflare_d1_database" "slumber_db" {
  account_id = var.cf_account_id
  name       = "slumber_db"
}

resource "cloudflare_worker_script" "slumber_games" {
  account_id = var.cf_account_id
  name       = "slumber_games"
  content    = file("dist/index.js")
  module     = true

  d1_database_binding {
    database_id = cloudflare_d1_database.slumber_db.id
    name        = "db"
  }

  secret_text_binding {
    name = "SLUMBER_USER"
    text = var.slumber_user
  }

  secret_text_binding {
    name = "SLUMBER_PASSWORD"
    text = var.slumber_password
  }
}

resource "cloudflare_worker_cron_trigger" "slumber_trigger" {
  account_id  = var.cf_account_id
  script_name = cloudflare_worker_script.slumber_games.name
  schedules   = ["0 22 * * *"]
}

resource "cloudflare_worker_route" "slumber_games_route" {
  zone_id     = var.cf_zone_id
  pattern     = var.cf_route
  script_name = cloudflare_worker_script.slumber_games.name
}
