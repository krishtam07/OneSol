# start-mysql.ps1
# Run this ONCE in a normal PowerShell window (right-click > Run as Administrator if needed)
# It starts MySQL and keeps it running

$mysqlBin = "C:\Program Files\MySQL\MySQL Server 8.4\bin\mysqld.exe"
$mysqlIni = "C:\Users\shanmukhi\mysql-data\my.ini"

Write-Host "Starting MySQL 8.4..." -ForegroundColor Cyan
& $mysqlBin "--defaults-file=$mysqlIni"
