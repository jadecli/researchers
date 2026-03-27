/**
 * C# SDK example: create message, tool use, and streaming
 * with the Anthropic API.
 *
 * NuGet: Install-Package Anthropic.SDK
 */
using System;
using System.Collections.Generic;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;

namespace AnthropicExample
{
    class Program
    {
        private static readonly HttpClient HttpClient = new();
        private static readonly string ApiKey = Environment.GetEnvironmentVariable("ANTHROPIC_API_KEY") ?? "";
        private const string ApiUrl = "https://api.anthropic.com/v1/messages";

        static async Task Main(string[] args)
        {
            Console.WriteLine("=== Create Message ===");
            await CreateMessageExample();

            Console.WriteLine("\n=== Tool Use ===");
            await ToolUseExample();

            Console.WriteLine("\n=== Streaming ===");
            await StreamingExample();
        }

        /// <summary>
        /// Basic message creation using the Anthropic REST API.
        /// </summary>
        static async Task CreateMessageExample()
        {
            var request = new
            {
                model = "claude-sonnet-4-20250514",
                max_tokens = 1024,
                messages = new[]
                {
                    new { role = "user", content = "Explain quantum computing in one paragraph." }
                }
            };

            var response = await SendRequest(request);
            var doc = JsonDocument.Parse(response);
            var content = doc.RootElement.GetProperty("content")[0];

            if (content.GetProperty("type").GetString() == "text")
            {
                Console.WriteLine($"Response: {content.GetProperty("text").GetString()}");
            }

            var usage = doc.RootElement.GetProperty("usage");
            Console.WriteLine($"Usage: {usage.GetProperty("input_tokens")} in, {usage.GetProperty("output_tokens")} out");
        }

        /// <summary>
        /// Tool use (function calling) example.
        /// </summary>
        static async Task ToolUseExample()
        {
            var request = new
            {
                model = "claude-sonnet-4-20250514",
                max_tokens = 1024,
                tools = new[]
                {
                    new
                    {
                        name = "get_weather",
                        description = "Get the current weather for a given location.",
                        input_schema = new
                        {
                            type = "object",
                            properties = new Dictionary<string, object>
                            {
                                ["location"] = new { type = "string", description = "City and state" },
                                ["unit"] = new { type = "string", description = "Temperature unit" }
                            },
                            required = new[] { "location" }
                        }
                    }
                },
                messages = new[]
                {
                    new { role = "user", content = "What's the weather in San Francisco?" }
                }
            };

            var response = await SendRequest(request);
            var doc = JsonDocument.Parse(response);

            foreach (var block in doc.RootElement.GetProperty("content").EnumerateArray())
            {
                if (block.GetProperty("type").GetString() == "tool_use")
                {
                    Console.WriteLine($"Tool call: {block.GetProperty("name").GetString()}");
                    Console.WriteLine($"Input: {block.GetProperty("input")}");
                }
            }
        }

        /// <summary>
        /// Streaming response example using SSE.
        /// </summary>
        static async Task StreamingExample()
        {
            var requestBody = JsonSerializer.Serialize(new
            {
                model = "claude-sonnet-4-20250514",
                max_tokens = 1024,
                stream = true,
                messages = new[]
                {
                    new { role = "user", content = "Write a haiku about programming." }
                }
            });

            var request = new HttpRequestMessage(HttpMethod.Post, ApiUrl);
            request.Headers.Add("x-api-key", ApiKey);
            request.Headers.Add("anthropic-version", "2023-06-01");
            request.Content = new StringContent(requestBody, Encoding.UTF8, "application/json");

            var response = await HttpClient.SendAsync(request, HttpCompletionOption.ResponseHeadersRead);
            response.EnsureSuccessStatusCode();

            using var stream = await response.Content.ReadAsStreamAsync();
            using var reader = new System.IO.StreamReader(stream);

            while (!reader.EndOfStream)
            {
                var line = await reader.ReadLineAsync();
                if (line != null && line.StartsWith("data: "))
                {
                    var data = line.Substring(6);
                    if (data == "[DONE]") break;

                    try
                    {
                        var eventDoc = JsonDocument.Parse(data);
                        if (eventDoc.RootElement.GetProperty("type").GetString() == "content_block_delta")
                        {
                            var delta = eventDoc.RootElement.GetProperty("delta");
                            if (delta.GetProperty("type").GetString() == "text_delta")
                            {
                                Console.Write(delta.GetProperty("text").GetString());
                            }
                        }
                    }
                    catch (JsonException) { }
                }
            }
            Console.WriteLine();
        }

        private static async Task<string> SendRequest(object body)
        {
            var json = JsonSerializer.Serialize(body);
            var request = new HttpRequestMessage(HttpMethod.Post, ApiUrl);
            request.Headers.Add("x-api-key", ApiKey);
            request.Headers.Add("anthropic-version", "2023-06-01");
            request.Content = new StringContent(json, Encoding.UTF8, "application/json");

            var response = await HttpClient.SendAsync(request);
            response.EnsureSuccessStatusCode();
            return await response.Content.ReadAsStringAsync();
        }
    }
}
