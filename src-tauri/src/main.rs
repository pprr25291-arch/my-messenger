#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::Manager;

#[tauri::command]
fn get_server_url() -> String {
    // В Tauri используем Render URL
    "https://my-messenger-9g2n.onrender.com".to_string()
}

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            let window = app.get_webview_window("main").unwrap();
            
            // Устанавливаем заголовок окна
            window.set_title("My Messenger").unwrap();
            
            // Для отладки
            #[cfg(debug_assertions)]
            {
                window.open_devtools();
            }
            
            println!("🚀 My Messenger Tauri App Starting...");
            println!("📡 Connecting to: https://my-messenger-9g2n.onrender.com");
            
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![get_server_url])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}