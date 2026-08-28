I want to make an API call to /v1/facebook/marketplace/search. Here are the details:

Endpoint: GET https://api.scrapecreators.com/v1/facebook/marketplace/search

Description: Search Facebook Marketplace listings

Required Headers:
- x-api-key: Your API key

Parameters:
- query (string) (Required): Search keyword
- lat (number) (Required): Latitude for the search location
- lng (number) (Required): Longitude for the search location
- radius_km (number): Search radius in kilometers
- min_price (number): Minimum listing price
- max_price (number): Maximum listing price
- count (number): Number of listings to return
- sort_by (select): Sort order
- delivery_method (select): Delivery filter
- condition (select): Condition filter
- date_listed (select): Date listed filter
- availability (select): Availability filter
- cursor (string): Opaque pagination cursor returned from the previous response. Pass it back as-is.

Example Response:
{
  "success": true,
  "credits_remaining": 49997831258,
  "credits_charged": 1,
  "listings": [
    {
      "id": "1880804689276480",
      "url": "https://www.facebook.com/marketplace/item/1880804689276480/",
      "title": "ANCHEER E Bike",
      "price": {
        "formatted_amount": "$300",
        "amount_with_offset_in_currency": 30000,
        "amount": 300
      },
      "strikethrough_price": null,
      "location": {
        "city": "Austin",
        "state": "TX",
        "display_name": "Austin, Texas",
        "city_page_id": "106224666074625"
      },
      "primary_photo": {
        "id": "742022888999863",
        "url": "https://scontent-bos5-1.xx.fbcdn.net/v/t39.84726-6/696326464_742022902333195_6718077421452400338_n.jpg?stp=c43.0.260.260a_dst-jpg_p261x260_tt6&_nc_cat=106&ccb=1-7&_nc_sid=92e707&_nc_ohc=dzY2b4-6EowQ7kNvwFDgohs&_nc_oc=AdomRHPRV49gouEOWqxlFxuEeLcoc5cBjRhXhi91oslqlUNdZ9EV-te1C_pvL-eyVzs&_nc_zt=14&_nc_ht=scontent-bos5-1.xx&_nc_gid=GvS1066o3EBgpWuqL6BQZA&_nc_ss=7e289&oh=00_Af6M2kbWMsKLjEHmSUv6oiPJt3skIfetxG3oB2YOIiDuTg&oe=6A0D6E08"
      },
      "category_id": "1658310421102081",
      "is_hidden": false,
      "is_live": true,
      "is_pending": false,
      "is_sold": false,
      "is_viewer_seller": false,
      "delivery_types": [
        "IN_PERSON",
        "PUBLIC_MEETUP",
        "DOOR_PICKUP",
        "DOOR_DROPOFF"
      ],
      "story_type": "POST",
      "story_key": "26881002338175809"
    },
    {
      "id": "950860437561765",
      "url": "https://www.facebook.com/marketplace/item/950860437561765/",
      "title": "Mountain Bike",
      "price": {
        "formatted_amount": "$60",
        "amount_with_offset_in_currency": 6000,
        "amount": 60
      },
      "strikethrough_price": null,
      "location": {
        "city": "San Antonio",
        "state": "TX",
        "display_name": "Lackland Air Force Base, Texas",
        "city_page_id": "114176668596309"
      },
      "primary_photo": {
        "id": "916476894743958",
        "url": "https://scontent-bos5-1.xx.fbcdn.net/v/t39.84726-6/691721405_916476901410624_3028002815259594366_n.jpg?stp=c0.0.261.261a_dst-jpg_p261x260_tt6&_nc_cat=106&ccb=1-7&_nc_sid=92e707&_nc_ohc=TfPaau7XFP0Q7kNvwEK8N_Q&_nc_oc=AdpR4yQav1U7gbYR9HnvVxKYtFLimvw6kYIhvOQJk8knqZCfuxb1MFiGHbckDI8_Jaw&_nc_zt=14&_nc_ht=scontent-bos5-1.xx&_nc_gid=GvS1066o3EBgpWuqL6BQZA&_nc_ss=7e289&oh=00_Af6fFQ1qcqTOTanOUI4cY2B8u6Uhuyl8owgyQKcz3P6TiQ&oe=6A0D44E6"
      },
      "category_id": "1658310421102081",
      "is_hidden": false,
      "is_live": true,
      "is_pending": false,
      "is_sold": false,
      "is_viewer_seller": false,
      "delivery_types": [
        "IN_PERSON"
      ],
      "story_type": "POST",
      "story_key": "27123216687304592"
    },
    {
      "id": "727510149974761",
      "url": "https://www.facebook.com/marketplace/item/727510149974761/",
      "title": "Like New Ozone 500 Boys’ Blaze 12-Inch Bike – Ridden Less Than 10 Times",
      "price": {
        "formatted_amount": "$40",
        "amount_with_offset_in_currency": 4000,
        "amount": 40
      },
      "strikethrough_price": null,
      "location": {
        "city": "Austin",
        "state": "TX",
        "display_name": "Austin, Texas",
        "city_page_id": "106224666074625"
      },
      "primary_photo": {
        "id": "735803309595330",
        "url": "https://scontent-bos5-1.xx.fbcdn.net/v/t39.84726-6/605226151_735803329595328_1386149983139267508_n.jpg?stp=c0.0.261.261a_dst-jpg_p261x260_tt6&_nc_cat=110&ccb=1-7&_nc_sid=92e707&_nc_ohc=X9CeUbTefJ8Q7kNvwGQA1xK&_nc_oc=AdrROVW00wzIDti0wdKukd-MIU43VqLwHnqWwclxqki7C-kvzuqEjfquMRANljbmwno&_nc_zt=14&_nc_ht=scontent-bos5-1.xx&_nc_gid=GvS1066o3EBgpWuqL6BQZA&_nc_ss=7e289&oh=00_Af4bteQsGq-7ncgAMm5XQOQh6T28wCH7XfeG7QEq1oA8jQ&oe=6A0D6ACA"
      },
      "category_id": "1658310421102081",
      "is_hidden": false,
      "is_live": true,
      "is_pending": false,
      "is_sold": false,
      "is_viewer_seller": false,
      "delivery_types": [
        "IN_PERSON"
      ],
      "story_type": "POST",
      "story_key": "25785888574376930"
    }
  ],
  "cursor": "eyJwZyI6MCwiYjJj....",
  "has_next_page": true
}

Please help me write code in Python to make this API call and handle the response appropriately. Include error handling and best practices.