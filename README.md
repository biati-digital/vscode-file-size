# File Size

A modern and fully customizable extension that displays the current file size in the status bar of your code editor.

![File Size](https://raw.githubusercontent.com/biati-digital/vscode-file-size/main/assets/cover.jpg "File Size")

## Features

- **File Size Display:** Displays the current file size in the status bar for easy reference.
- **Customizable Text:** Customize the status bar text to display any text you want.
- **Date Format Customization:** Freely customize the date format according to your preferences.
- **Positioning and Ordering:** Customize the status bar position and the order of displayed items.
- **Compression Support:** Supports file size calculation for Gzip and Brotli compressed files.
- **Tooltip Support:** When hovering over the status bar item, a tooltip will appear, providing additional details about the file.

## Extension Settings

### `filesize.statusBarText`

You can write any text and use variables, for example: `Gzip: ${GZIP_SIZE} | Brotli ${BROTLI_SIZE}` You can use the following variables in the status bar text:

- ORIGINAL_SIZE
- GZIP_SIZE
- BROTLI_SIZE
- CREATED_DATE
- CHANGED_DATE

### `filesize.sizeMode`

Choose how to format the file size. You can use Binary Mode where 1 MB = 1024 KB or  the IEC Standard where 1 MB = 1000 KB

### `filesize.dateFormat`

Customize the date format, you can find more info at [https://day.js.org/docs/en/display/format](https://day.js.org/docs/en/display/format) default value is `YYYY-MM-DD, HH:mm:ss`

### `filesize.statusItemPosition`

Select the postion of the item in the status bar

### `filesize.statusItemPriority`

For more control you can also change the status bar item priority. Higher values mean the item should be shown more to the left. With the options `filesize.statusItemPosition` and `filesize.statusItemPriority` you can fully control the position in the status bar.
