<?php
/**
 * حذف داده‌های افزونه در صورت حذف کامل از وردپرس.
 * برنامه خود داده‌ای در دیتابیس وردپرس ذخیره نمی‌کند (داده‌ها در localStorage مرورگر هر رایانه است).
 */

if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
	exit;
}

delete_option( 'rsi_settings' );
