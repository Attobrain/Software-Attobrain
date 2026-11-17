using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Text;
using System.Threading;
using System.Windows.Forms;

internal static class AttobrainLauncher
{
    private static readonly object LogLock = new object();
    private static string logPath;

    [STAThread]
    private static void Main()
    {
        try
        {
            string root = FindProjectRoot(AppDomain.CurrentDomain.BaseDirectory);
            if (root == null)
            {
                ShowError("Não encontrei a pasta do Attobrain. Mantenha o executável dentro da pasta dist do projeto.");
                return;
            }

            logPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "attobrain-launcher.log");
            Dictionary<string, string> env = ReadEnv(Path.Combine(root, ".env"));
            int appPort = ReadPort(env, "PORT", 3000);
            string appUrl = "http://localhost:" + appPort + "/login";

            if (IsAttobrainReady(appPort))
            {
                OpenBrowser(appUrl);
                return;
            }
            if (IsPortOpen("127.0.0.1", appPort, 700))
            {
                ShowError("A porta " + appPort + " já está sendo usada por outro programa. Feche-o ou altere PORT no arquivo .env.");
                return;
            }

            string node = FindNode(AppDomain.CurrentDomain.BaseDirectory, root);
            if (node == null)
            {
                ShowError("O Node.js não foi encontrado. Recompile o lançador para incluir runtime\\node.exe ou instale o Node.js.");
                return;
            }
            if (!File.Exists(Path.Combine(root, "index.js")) || !Directory.Exists(Path.Combine(root, "node_modules")))
            {
                ShowError("Os arquivos do sistema estão incompletos. Mantenha index.js e node_modules na pasta do Attobrain.");
                return;
            }

            string envFile = Path.Combine(root, ".env");
            if (!File.Exists(envFile))
            {
                ShowError("O arquivo .env não foi encontrado. Copie .env.example para .env e configure o MySQL do XAMPP uma vez.");
                return;
            }

            string dbHost = Get(env, "DB_HOST", "localhost");
            int dbPort = ReadPort(env, "DB_PORT", 3306);
            if (!EnsureMySql(dbHost, dbPort)) return;

            ProcessStartInfo start = new ProcessStartInfo();
            start.FileName = node;
            start.Arguments = "--env-file=.env index.js";
            start.WorkingDirectory = root;
            start.UseShellExecute = false;
            start.CreateNoWindow = true;
            start.RedirectStandardOutput = true;
            start.RedirectStandardError = true;

            Process server = Process.Start(start);
            if (server == null)
            {
                ShowError("O servidor do Attobrain não pôde ser iniciado.");
                return;
            }
            server.OutputDataReceived += OnServerOutput;
            server.ErrorDataReceived += OnServerOutput;
            server.BeginOutputReadLine();
            server.BeginErrorReadLine();

            if (!WaitForServer(appPort, server, 25000))
            {
                string details = server.HasExited ? " O servidor encerrou durante a inicialização." : " O servidor ainda não respondeu.";
                WriteLog(details);
                ShowError("Não foi possível iniciar o Attobrain." + details + Environment.NewLine + "Consulte " + logPath + " para ver o motivo.");
                return;
            }

            OpenBrowser(appUrl);
        }
        catch (Exception error)
        {
            WriteLog(error.ToString());
            ShowError("O Attobrain não pôde ser iniciado. Consulte " + (logPath ?? "o log do lançador") + " para ver o motivo.");
        }
    }

    private static string FindProjectRoot(string start)
    {
        DirectoryInfo current = new DirectoryInfo(start);
        while (current != null)
        {
            if (File.Exists(Path.Combine(current.FullName, "index.js")) &&
                File.Exists(Path.Combine(current.FullName, "package.json")))
                return current.FullName;
            current = current.Parent;
        }
        return null;
    }

    private static Dictionary<string, string> ReadEnv(string path)
    {
        Dictionary<string, string> values = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        if (!File.Exists(path)) return values;
        foreach (string raw in File.ReadAllLines(path))
        {
            string line = raw.Trim();
            if (line.Length == 0 || line.StartsWith("#")) continue;
            int split = line.IndexOf('=');
            if (split <= 0) continue;
            string key = line.Substring(0, split).Trim();
            string value = line.Substring(split + 1).Trim();
            if (value.Length >= 2 && ((value[0] == '"' && value[value.Length - 1] == '"') || (value[0] == '\'' && value[value.Length - 1] == '\'')))
                value = value.Substring(1, value.Length - 2);
            values[key] = value;
        }
        return values;
    }

    private static string Get(Dictionary<string, string> values, string key, string fallback)
    {
        string value;
        return values.TryGetValue(key, out value) && !String.IsNullOrWhiteSpace(value) ? value : fallback;
    }

    private static int ReadPort(Dictionary<string, string> values, string key, int fallback)
    {
        int port;
        return values.ContainsKey(key) && Int32.TryParse(values[key], out port) && port > 0 && port < 65536 ? port : fallback;
    }

    private static string FindNode(string launcherDirectory, string root)
    {
        string[] localCandidates = new string[] {
            Path.Combine(launcherDirectory, "runtime", "node.exe"),
            Path.Combine(root, "runtime", "node.exe")
        };
        foreach (string candidate in localCandidates)
            if (File.Exists(candidate)) return candidate;

        string path = Environment.GetEnvironmentVariable("PATH") ?? "";
        foreach (string directory in path.Split(Path.PathSeparator))
        {
            string candidate = Path.Combine(directory.Trim().Trim('"'), "node.exe");
            if (File.Exists(candidate)) return candidate;
        }
        return null;
    }

    private static bool EnsureMySql(string host, int port)
    {
        if (IsPortOpen(host, port, 1000)) return true;
        if (!IsLocalHost(host))
        {
            ShowError("Não consegui conectar ao MySQL em " + host + ":" + port + ". Confirme se o banco está disponível.");
            return false;
        }

        Process[] mysqlInstances = Process.GetProcessesByName("mysqld");
        if (mysqlInstances.Length > 0)
        {
            DateTime existingDeadline = DateTime.UtcNow.AddSeconds(12);
            while (DateTime.UtcNow < existingDeadline)
            {
                if (IsPortOpen(host, port, 500)) return true;
                Thread.Sleep(500);
            }
            ShowError("O processo do MySQL já existe, mas não respondeu na porta " + port + ". Confira o estado do MySQL no painel do XAMPP.");
            return false;
        }

        string xampp = FindXampp();
        if (xampp == null)
        {
            ShowError("O MySQL não está ativo e não encontrei o XAMPP. Abra o painel do XAMPP, inicie o MySQL e tente novamente.");
            return false;
        }

        string mysqld = Path.Combine(xampp, "mysql", "bin", "mysqld.exe");
        string ini = Path.Combine(xampp, "mysql", "bin", "my.ini");
        if (!File.Exists(mysqld) || !File.Exists(ini))
        {
            ShowError("Encontrei o XAMPP em " + xampp + ", mas não localizei a configuração do MySQL. Inicie MySQL pelo painel do XAMPP.");
            return false;
        }

        ProcessStartInfo start = new ProcessStartInfo();
        start.FileName = mysqld;
        start.Arguments = "--defaults-file=\"" + ini + "\" --standalone";
        start.WorkingDirectory = xampp;
        start.UseShellExecute = false;
        start.CreateNoWindow = true;
        Process mysql = Process.Start(start);
        if (mysql == null)
        {
            ShowError("Não consegui iniciar o MySQL do XAMPP. Abra o painel do XAMPP, inicie o MySQL e tente novamente.");
            return false;
        }

        DateTime deadline = DateTime.UtcNow.AddSeconds(25);
        while (DateTime.UtcNow < deadline)
        {
            if (IsPortOpen(host, port, 500)) return true;
            if (mysql.HasExited) break;
            Thread.Sleep(500);
        }
        ShowError("O MySQL do XAMPP não respondeu na porta " + port + ". Abra o painel do XAMPP, confira o estado do MySQL e tente novamente.");
        return false;
    }

    private static bool IsLocalHost(string host)
    {
        return String.Equals(host, "localhost", StringComparison.OrdinalIgnoreCase) ||
            String.Equals(host, "127.0.0.1", StringComparison.OrdinalIgnoreCase) ||
            String.Equals(host, "::1", StringComparison.OrdinalIgnoreCase);
    }

    private static string FindXampp()
    {
        List<string> candidates = new List<string>();
        string configured = Environment.GetEnvironmentVariable("XAMPP_HOME");
        if (!String.IsNullOrWhiteSpace(configured)) candidates.Add(configured);
        candidates.AddRange(new string[] { "C:\\xampp", "C:\\Program Files\\xampp", "C:\\Program Files (x86)\\xampp", "D:\\xampp" });
        foreach (string candidate in candidates)
            if (File.Exists(Path.Combine(candidate, "mysql", "bin", "mysqld.exe"))) return candidate;
        return null;
    }

    private static bool IsPortOpen(string host, int port, int timeout)
    {
        try
        {
            using (TcpClient client = new TcpClient())
            {
                IAsyncResult result = client.BeginConnect(host, port, null, null);
                using (result.AsyncWaitHandle)
                {
                    if (!result.AsyncWaitHandle.WaitOne(timeout)) return false;
                    client.EndConnect(result);
                    return client.Connected;
                }
            }
        }
        catch { return false; }
    }

    private static bool IsAttobrainReady(int port)
    {
        try
        {
            HttpWebRequest request = (HttpWebRequest)WebRequest.Create("http://127.0.0.1:" + port + "/health");
            request.Method = "GET";
            request.Timeout = 1000;
            request.ReadWriteTimeout = 1000;
            request.Proxy = null;
            using (HttpWebResponse response = (HttpWebResponse)request.GetResponse())
            using (StreamReader reader = new StreamReader(response.GetResponseStream()))
                return response.StatusCode == HttpStatusCode.OK && reader.ReadToEnd().Contains("\"ok\":true");
        }
        catch { return false; }
    }

    private static bool WaitForServer(int port, Process server, int timeout)
    {
        DateTime deadline = DateTime.UtcNow.AddMilliseconds(timeout);
        while (DateTime.UtcNow < deadline)
        {
            if (IsAttobrainReady(port)) return true;
            if (server.HasExited) return false;
            Thread.Sleep(350);
        }
        return IsAttobrainReady(port);
    }

    private static void OpenBrowser(string url)
    {
        Process.Start(new ProcessStartInfo(url) { UseShellExecute = true });
    }

    private static void OnServerOutput(object sender, DataReceivedEventArgs args)
    {
        if (args.Data != null) WriteLog(args.Data);
    }

    private static void WriteLog(string value)
    {
        if (String.IsNullOrEmpty(logPath)) return;
        try
        {
            lock (LogLock)
                File.AppendAllText(logPath, DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss") + " " + value + Environment.NewLine, Encoding.UTF8);
        }
        catch { }
    }

    private static void ShowError(string message)
    {
        MessageBox.Show(message, "Attobrain", MessageBoxButtons.OK, MessageBoxIcon.Warning);
    }
}
