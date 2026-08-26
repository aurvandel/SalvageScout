import {describe,it,expect,vi,beforeEach,afterEach} from 'vitest'
import {screen,waitFor} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ListingDetail from './ListingDetail'
import * as client from '../api/client'
import {makeListing,makeImage,makeScore} from '../test/fixtures'
import {renderWithRouter} from '../test/testUtils'
vi.mock('../api/client')
describe('ListingDetail',()=>{
  const mockFetchListing=vi.mocked(client.fetchListing)
  const mockSetFavorite=vi.mocked(client.setFavorite)
  const mockSetHidden=vi.mocked(client.setHidden)
  const mockDeleteListing=vi.mocked(client.deleteListing)
  const mockMarkListingViewed=vi.mocked(client.markListingViewed)
  let alertSpy: any
  let confirmSpy: any
  beforeEach(()=>{
    vi.clearAllMocks()
    mockMarkListingViewed.mockResolvedValue(makeListing())
    alertSpy=vi.spyOn(window,'alert').mockImplementation(()=>{})
    confirmSpy=vi.spyOn(window,'confirm').mockImplementation(()=>false)
  })
  afterEach(()=>{
    alertSpy.mockRestore()
    confirmSpy.mockRestore()
  })
  describe('loading/error',()=>{
    it('shows loading',()=>{
      mockFetchListing.mockImplementation(()=>new Promise(()=>{}))
      renderWithRouter(<ListingDetail />,{route:'/listings/1',path:'/listings/:id'})
      expect(screen.getByText('Loading...')).toBeInTheDocument()
    })
    it('shows error',async()=>{
      mockFetchListing.mockRejectedValue(new Error('fail'))
      renderWithRouter(<ListingDetail />,{route:'/listings/1',path:'/listings/:id'})
      await waitFor(()=>{
        expect(screen.getByText(/Failed to load listing/)).toBeInTheDocument()
      })
    })
  })
  describe('load',()=>{
    it('fetches by id',async()=>{
      const listing=makeListing({id:99})
      mockFetchListing.mockResolvedValue(listing)
      renderWithRouter(<ListingDetail />,{route:'/listings/99',path:'/listings/:id'})
      await waitFor(()=>{
        expect(mockFetchListing).toHaveBeenCalledWith(99)
      })
    })
    it('renders title/price',async()=>{
      const listing=makeListing({title:'BMW',price_amount:15000})
      mockFetchListing.mockResolvedValue(listing)
      renderWithRouter(<ListingDetail />,{route:'/listings/1',path:'/listings/:id'})
      await waitFor(()=>{
        expect(screen.getByText('BMW')).toBeInTheDocument()
        expect(screen.getByText('$15,000')).toBeInTheDocument()
      })
    })
  })
  describe('gallery',()=>{
    it('renders 3 images',async()=>{
      const listing=makeListing({images:[makeImage({id:2,position:2,image_url:"https://example.com/2.jpg"}),makeImage({id:0,position:0,image_url:"https://example.com/0.jpg"}),makeImage({id:1,position:1,image_url:"https://example.com/1.jpg"})]})
      mockFetchListing.mockResolvedValue(listing)
      renderWithRouter(<ListingDetail />,{route:'/listings/1',path:'/listings/:id'})
      await waitFor(()=>{
        const imgs=document.querySelectorAll('.listing-detail-gallery img')
        expect(imgs.length).toBe(3)
      })
    })
    it('empty',async()=>{
      const listing=makeListing({images:[]})
      mockFetchListing.mockResolvedValue(listing)
      renderWithRouter(<ListingDetail />,{route:'/listings/1',path:'/listings/:id'})
      await waitFor(()=>{
        expect(document.querySelector('.listing-detail-gallery')).not.toBeInTheDocument()
      })
    })
  })
  describe('specs',()=>{
    it('renders all',async()=>{
      const listing=makeListing({year:2015,make:'Honda',model:'Civic',mileage:45123})
      mockFetchListing.mockResolvedValue(listing)
      renderWithRouter(<ListingDetail />,{route:'/listings/1',path:'/listings/:id'})
      await waitFor(()=>{
        expect(screen.getByText('2015')).toBeInTheDocument()
        expect(screen.getByText('45,123 mi')).toBeInTheDocument()
      })
    })
    it('omits null',async()=>{
      const listing=makeListing({year:null})
      mockFetchListing.mockResolvedValue(listing)
      renderWithRouter(<ListingDetail />,{route:'/listings/1',path:'/listings/:id'})
      await waitFor(()=>{
        expect(screen.queryAllByText('Year').length).toBe(0)
      })
    })
  })
  describe('score',()=>{
    it('renders all parts',async()=>{
      const listing=makeListing({scores:[makeScore({match_score:85,summary:'Good',pros:['A','B'],cons:['C'],dealbreaker_flags:['D']})]})
      mockFetchListing.mockResolvedValue(listing)
      renderWithRouter(<ListingDetail />,{route:'/listings/1',path:'/listings/:id'})
      await waitFor(()=>{
        expect(screen.getByText(/85/)).toBeInTheDocument()
        expect(screen.getByText('A')).toBeInTheDocument()
      })
    })
    it('empty',async()=>{
      const listing=makeListing({scores:[]})
      mockFetchListing.mockResolvedValue(listing)
      renderWithRouter(<ListingDetail />,{route:'/listings/1',path:'/listings/:id'})
      await waitFor(()=>{
        expect(screen.queryAllByText(/Match score/).length).toBe(0)
      })
    })
  })
  describe('desc',()=>{
    it('renders',async()=>{
      const listing=makeListing({description:'Test'})
      mockFetchListing.mockResolvedValue(listing)
      renderWithRouter(<ListingDetail />,{route:'/listings/1',path:'/listings/:id'})
      await waitFor(()=>{
        expect(screen.getByText('Test')).toBeInTheDocument()
      })
    })
    it('omits null',async()=>{
      const listing=makeListing({description:null})
      mockFetchListing.mockResolvedValue(listing)
      renderWithRouter(<ListingDetail />,{route:'/listings/1',path:'/listings/:id'})
      await waitFor(()=>{
        expect(screen.queryAllByText('Description').length).toBe(0)
      })
    })
  })
  describe('favorite',()=>{
    it('toggle',async()=>{
      const listing=makeListing({id:42,is_favorite:false})
      mockFetchListing.mockResolvedValue(listing)
      mockSetFavorite.mockResolvedValue(listing)
      const user=userEvent.setup()
      renderWithRouter(<ListingDetail />,{route:'/listings/42',path:'/listings/:id'})
      await waitFor(()=>{expect(screen.getByRole('button',{name:/Favorite/})).toBeInTheDocument()})
      await user.click(screen.getByRole('button',{name:/Favorite/}))
      expect(mockSetFavorite).toHaveBeenCalledWith(42,true)
    })
    it('error',async()=>{
      const listing=makeListing({id:1,is_favorite:false})
      mockFetchListing.mockResolvedValue(listing)
      mockSetFavorite.mockRejectedValue(new Error('E'))
      const user=userEvent.setup()
      renderWithRouter(<ListingDetail />,{route:'/listings/1',path:'/listings/:id'})
      await waitFor(()=>{expect(screen.getByRole('button',{name:/Favorite/})).toBeInTheDocument()})
      await user.click(screen.getByRole('button',{name:/Favorite/}))
      await waitFor(()=>{expect(alertSpy).toHaveBeenCalledWith('Failed to update favorite.')})
    })
  })
  describe('hidden',()=>{
    it('toggle',async()=>{
      const listing=makeListing({id:77,is_hidden:false})
      mockFetchListing.mockResolvedValue(listing)
      mockSetHidden.mockResolvedValue(listing)
      const user=userEvent.setup()
      renderWithRouter(<ListingDetail />,{route:'/listings/77',path:'/listings/:id'})
      await waitFor(()=>{expect(screen.getByRole('button',{name:/Hide/})).toBeInTheDocument()})
      await user.click(screen.getByRole('button',{name:/Hide/}))
      expect(mockSetHidden).toHaveBeenCalledWith(77,true)
    })
    it('error',async()=>{
      const listing=makeListing({id:1,is_hidden:false})
      mockFetchListing.mockResolvedValue(listing)
      mockSetHidden.mockRejectedValue(new Error('E'))
      const user=userEvent.setup()
      renderWithRouter(<ListingDetail />,{route:'/listings/1',path:'/listings/:id'})
      await waitFor(()=>{expect(screen.getByRole('button',{name:/Hide/})).toBeInTheDocument()})
      await user.click(screen.getByRole('button',{name:/Hide/}))
      await waitFor(()=>{expect(alertSpy).toHaveBeenCalledWith('Failed to update hidden state.')})
    })
  })
  describe('delete',()=>{
    it('cancel',async()=>{
      const listing=makeListing()
      mockFetchListing.mockResolvedValue(listing)
      confirmSpy.mockReturnValue(false)
      const user=userEvent.setup()
      renderWithRouter(<ListingDetail />,{route:'/listings/1',path:'/listings/:id'})
      await waitFor(()=>{expect(screen.getByRole('button',{name:/Delete/})).toBeInTheDocument()})
      await user.click(screen.getByRole('button',{name:/Delete/}))
      expect(mockDeleteListing).not.toHaveBeenCalled()
    })
    it('confirm',async()=>{
      const listing=makeListing({id:88})
      mockFetchListing.mockResolvedValue(listing)
      mockDeleteListing.mockResolvedValue(listing)
      confirmSpy.mockReturnValue(true)
      const user=userEvent.setup()
      renderWithRouter(<ListingDetail />,{route:'/listings/88',path:'/listings/:id'})
      await waitFor(()=>{expect(screen.getByRole('button',{name:/Delete/})).toBeInTheDocument()})
      await user.click(screen.getByRole('button',{name:/Delete/}))
      await waitFor(()=>{expect(mockDeleteListing).toHaveBeenCalledWith(88)})
    })
    it('error',async()=>{
      const listing=makeListing()
      mockFetchListing.mockResolvedValue(listing)
      mockDeleteListing.mockRejectedValue(new Error('E'))
      confirmSpy.mockReturnValue(true)
      const user=userEvent.setup()
      renderWithRouter(<ListingDetail />,{route:'/listings/1',path:'/listings/:id'})
      await waitFor(()=>{expect(screen.getByRole('button',{name:/Delete/})).toBeInTheDocument()})
      await user.click(screen.getByRole('button',{name:/Delete/}))
      await waitFor(()=>{expect(alertSpy).toHaveBeenCalledWith('Failed to delete listing.')})
    })
  })
  describe('back',()=>{
    it('link',async()=>{
      const listing=makeListing()
      mockFetchListing.mockResolvedValue(listing)
      renderWithRouter(<ListingDetail />,{route:'/listings/1',path:'/listings/:id'})
      await waitFor(()=>{
        const link=screen.getByRole('link',{name:/Back/})
        expect(link).toHaveAttribute('href','/')
      })
    })
  })
})