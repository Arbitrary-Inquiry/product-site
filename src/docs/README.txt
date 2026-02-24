================================================================================
SimpleSight Server - Quick Start Guide
================================================================================

CONGRATULATIONS!

SimpleSight Server has been successfully installed on this computer.

--------------------------------------------------------------------------------
SERVER INFORMATION
--------------------------------------------------------------------------------

Installation Path:   C:\Program Files\SimpleSight Server
Database Location:   C:\ProgramData\SimpleSight\inventory.db
Logs Directory:      C:\ProgramData\SimpleSight\logs
Server URL:          {SERVER_URL}

The server starts automatically when Windows boots and runs with administrator
privileges via Windows Task Scheduler.

--------------------------------------------------------------------------------
ACCESSING THE WEB INTERFACE
--------------------------------------------------------------------------------

1. Open a web browser on this computer
2. Navigate to: {SERVER_URL}
3. Login with the admin credentials you created during installation

Note: The first time you access the server, your browser should trust the
      HTTPS connection automatically (the certificate was installed to your
      Windows Trusted Root store during setup).

--------------------------------------------------------------------------------
DEPLOYING AGENTS TO CLIENT COMPUTERS
--------------------------------------------------------------------------------

The agent installer is ready to deploy and located at:

    C:\Program Files\SimpleSight Server\agent\SimpleSightInstaller.exe

To deploy an agent:

1. Copy SimpleSightInstaller.exe to the target computer
2. Run it as Administrator
3. Enter your server URL: {SERVER_URL}
4. Enter your admin credentials
5. Complete the wizard

The agent will:
- Automatically generate an authentication token via the API
- Install itself to C:\Program Files\SimpleSight
- Create scheduled tasks to run at startup and every 4 hours
- Perform an immediate inventory check-in

--------------------------------------------------------------------------------
NEXT STEPS
--------------------------------------------------------------------------------

1. Access the web UI and verify the server is running
2. Deploy agents to your computers
3. Monitor device check-ins in the web dashboard

For detailed deployment instructions, see:
    DEPLOYMENT_GUIDE.txt

For network configuration and DNS setup, see:
    NETWORK_CONFIGURATION.txt

For common issues and solutions, see:
    TROUBLESHOOTING.txt

--------------------------------------------------------------------------------
IMPORTANT NOTES
--------------------------------------------------------------------------------

SERVER REQUIREMENTS:
- The server computer needs a STATIC IP address or proper DNS configuration
  for agents to connect reliably. See NETWORK_CONFIGURATION.txt for details.

- The server runs continuously and will restart automatically if Windows
  reboots. Check Task Scheduler for "SimpleSight Server" if needed.

SECURITY:
- The server uses HTTPS with a self-signed certificate
- All agent connections are authenticated with bearer tokens
- Web UI uses JWT authentication with bcrypt password hashing
- Agents communicate over TLS/HTTPS only

BACKUP:
- Database: C:\ProgramData\SimpleSight\inventory.db
- Back this up regularly to prevent data loss
- You can copy it to another location or use Windows Backup

--------------------------------------------------------------------------------
SUPPORT & DOCUMENTATION
--------------------------------------------------------------------------------

All documentation is located in:
    C:\Program Files\SimpleSight Server\docs\

Available guides:
- README.txt                 - This file
- DEPLOYMENT_GUIDE.txt       - Step-by-step deployment instructions
- NETWORK_CONFIGURATION.txt  - DNS and IP address setup
- TROUBLESHOOTING.txt        - Common issues and solutions
- ARCHITECTURE.txt           - Technical overview and system design

--------------------------------------------------------------------------------

SimpleSight - Lightweight IT Asset Management

================================================================================
